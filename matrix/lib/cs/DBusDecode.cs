namespace MatrixDBus__TAG__
{
    using System;
    using System.Collections.Generic;
    using System.Text;

    // Values and messages off the wire, with the framing every reader of raw
    // message bytes shares. The writing half is DBusEncode.cs.
    public static partial class Wire
    {
        // --- reading ---------------------------------------------------------------

        sealed class Cur
        {
            readonly byte[] a;
            public int p;
            readonly int end;
            public Cur(byte[] a, int start, int len) { this.a = a; p = start; end = start + len; }
            // Counts arrive off the wire. Measured against the room left, because
            // `p + n > end` overflows on a huge count and passes a negative one.
            void Check(int n) { if (n < 0 || n > end - p) throw new DBusException("matrix: truncated D-Bus value"); }
            public int Pad(int al) { int skip = (al - (p % al)) % al; Check(skip); p += skip; return skip; }
            // Padding allowed to run past the end. A header array's fields stop
            // where they stop, and the next one's 8-alignment is not ours to insist on.
            public void PadLenient(int al) { int skip = (al - (p % al)) % al; p = Math.Min(p + skip, end); }
            public byte Byte() { Check(1); return a[p++]; }
            public int I16() { Pad(2); Check(2); int v = a[p] | a[p + 1] << 8; p += 2; return v; }
            public int I32() { Pad(4); Check(4); int v = a[p] | a[p + 1] << 8 | a[p + 2] << 16 | a[p + 3] << 24; p += 4; return v; }
            public uint U32() { return unchecked((uint)I32()); }
            public long I64() { Pad(8); Check(8); long v = 0; for (int i = 7; i >= 0; i--) v = (v << 8) | a[p + i]; p += 8; return v; }
            // A length is a u32 on the wire and an int here, so a desynced stream can
            // present it as negative. Check(n + 1) passes that: -1 asks for 0 bytes.
            public string Str()
            {
                int n = I32();
                if (n < 0) throw new DBusException("matrix: D-Bus string declares an impossible length");
                Check(n + 1);
                string s = Encoding.UTF8.GetString(a, p, n);
                p += n + 1;
                return s;
            }
            public string SigStr() { int n = Byte(); Check(n + 1); string s = Encoding.ASCII.GetString(a, p, n); p += n + 1; return s; }
        }

        public static object[] DecodeValues(byte[] body, string sig)
        {
            return ReadSig(new Cur(body, 0, body.Length), sig ?? "");
        }

        static object[] ReadSig(Cur c, string sig)
        {
            List<object> outv = new List<object>();
            for (int s = 0; s < sig.Length; s += TypeLen(sig, s))
            {
                switch (sig[s])
                {
                    case 'y': outv.Add(c.Byte()); break;
                    case 'b': outv.Add(c.I32() != 0); break;
                    case 'n': outv.Add((short)c.I16()); break;
                    case 'q': outv.Add((ushort)c.I16()); break;
                    case 'i': case 'h': outv.Add(c.I32()); break;
                    case 'u': outv.Add(c.U32()); break;
                    case 'x': case 't': outv.Add(c.I64()); break;
                    case 'd': outv.Add(BitConverter.Int64BitsToDouble(c.I64())); break;
                    case 's': case 'o': outv.Add(c.Str()); break;
                    case 'g': outv.Add(c.SigStr()); break;
                    case 'v':
                        // No padding of its own: a variant aligns to 1, and the
                        // value inside pads from wherever its signature ends.
                        string vsig = c.SigStr();
                        object[] inner = ReadSig(c, vsig);
                        outv.Add(new Variant(vsig, inner.Length == 1 ? inner[0] : inner));
                        break;
                    case 'a':
                        string elemSig = sig.Substring(s + 1, TypeLen(sig, s + 1));
                        outv.Add(ReadArray(c, elemSig));
                        break;
                    default:
                        throw new DBusException("matrix: cannot read D-Bus type '" + sig[s] + "'");
                }
            }
            return outv.ToArray();
        }

        static object ReadArray(Cur c, string elemSig)
        {
            c.Pad(4);
            int len = c.I32();
            // The length counts the element data only. Pad to the first element
            // before measuring the end, or every 8-aligned element type reads four
            // bytes short of its own encoding.
            c.Pad(AlignmentOf(elemSig[0]));
            int dataEnd = c.p + len;
            List<object> items = new List<object>();
            while (c.p < dataEnd) items.AddRange(ReadSig(c, elemSig));
            if (c.p != dataEnd) throw new DBusException("matrix: D-Bus array length does not cover its elements");
            if (IsStringType(elemSig)) return ToStringArray(items);
            return items.ToArray();
        }

        // The Konsole calls read back lists of names. PowerShell and the callers
        // both enumerate a string[]; a boxed object[] they have to cast.
        static bool IsStringType(string sig) { return sig == "s" || sig == "o" || sig == "g"; }

        static string[] ToStringArray(List<object> items)
        {
            string[] a = new string[items.Count];
            for (int i = 0; i < items.Count; i++) a[i] = (string)items[i];
            return a;
        }

        // One little-endian u32 out of raw message bytes. Every reader of message
        // bytes comes here, so the endianness is spelled once.
        public static uint ReadU32(byte[] m, int off)
        {
            return unchecked((uint)(m[off] | m[off + 1] << 8 | m[off + 2] << 16 | m[off + 3] << 24));
        }

        // Where the body starts, given the header field array's length. The message
        // decoder, the socket reader and the fake bus must all frame a message the
        // same way, so they all call this.
        public static int BodyStart(int arrLen) { return (HEADER_SIZE + arrLen + 7) & ~7; }

        // The specification's ceiling on one message. A call that timed out mid-reply
        // leaves the stream desynced, so the next read takes body bytes for a header.
        // A u32 above int.MaxValue then casts negative, and a merely enormous one has
        // Bus.ReadMessage allocate it before anything has judged it.
        public const uint MAX_MESSAGE = 0x08000000;   // 128 MiB

        public static void CheckLengths(uint bodyLen, uint arrLen)
        {
            if (bodyLen > MAX_MESSAGE || arrLen > MAX_MESSAGE)
                throw new DBusException("matrix: D-Bus message declares an impossible length");
        }

        // One pass over the header field array, handing each code and value to the
        // caller. The grammar is a lenient 8-alignment, a byte code, a signature and
        // a value. A header array claiming more than the buffer holds ends where the
        // buffer does.
        static void WalkFields(byte[] m, int arrLen, Action<byte, object[]> onField)
        {
            int fieldsEnd = Math.Max(HEADER_SIZE, Math.Min(HEADER_SIZE + arrLen, m.Length));
            Cur c = new Cur(m, HEADER_SIZE, fieldsEnd - HEADER_SIZE);
            while (c.p < fieldsEnd)
            {
                c.PadLenient(8);
                if (c.p >= fieldsEnd) break;
                byte code = c.Byte();
                onField(code, ReadSig(c, c.SigStr()));
            }
        }

        public static void DecodeMessage(byte[] m, out byte type, out uint replySerial,
                                         out string errorName, out string sig, out byte[] body)
        {
            if (m == null || m.Length < HEADER_SIZE) throw new DBusException("matrix: D-Bus message too short");
            if (m[0] != (byte)'l') throw new DBusException("matrix: D-Bus message is not little endian");
            type = m[1];
            CheckLengths(ReadU32(m, BODY_LEN_AT), ReadU32(m, ARRAY_LEN_AT));
            int bodyLen = (int)ReadU32(m, BODY_LEN_AT);
            int arrLen = (int)ReadU32(m, ARRAY_LEN_AT);
            replySerial = 0; errorName = ""; sig = ""; body = new byte[0];

            int bodyStart = BodyStart(arrLen);
            if (bodyStart + bodyLen > m.Length) throw new DBusException("matrix: D-Bus message truncated");
            body = new byte[bodyLen];
            Array.Copy(m, bodyStart, body, 0, bodyLen);

            // Locals, because an out parameter cannot be captured by the delegate.
            uint rs = 0; string en = "", sg = "";
            WalkFields(m, arrLen, delegate(byte code, object[] v)
            {
                if (v.Length == 0) return;
                if (code == FIELD_ERROR_NAME) en = (string)v[0];
                else if (code == FIELD_REPLY_SERIAL) rs = unchecked((uint)Convert.ToInt64(v[0]));
                else if (code == FIELD_SIGNATURE) sg = (string)v[0];
            });
            replySerial = rs; errorName = en; sig = sg;
        }

        // The string value of one header field, so the fake bus can read what a
        // client sent it. Null when the field is not there.
        public static string HeaderString(byte[] m, byte code)
        {
            if (m == null || m.Length < HEADER_SIZE) return null;
            string found = null;
            WalkFields(m, (int)ReadU32(m, ARRAY_LEN_AT), delegate(byte f, object[] v)
            {
                if (found == null && f == code && v.Length > 0) found = Convert.ToString(v[0]);
            });
            return found;
        }
    }
}
