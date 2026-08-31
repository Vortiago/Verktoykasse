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
            // Counts reach here off the wire, so this cannot be spelled as
            // `p + n > end`: a huge one overflows int and compares as negative,
            // and a negative one passes outright. Measured against the room
            // left instead, which never overflows.
            void Check(int n) { if (n < 0 || n > end - p) throw new DBusException("matrix: truncated D-Bus value"); }
            public int Pad(int al) { int skip = (al - (p % al)) % al; Check(skip); p += skip; return skip; }
            // Padding that may run past the end: a header array's fields stop
            // wherever they stop, and the 8-alignment of the NEXT one is not ours to
            // insist on.
            public void PadLenient(int al) { int skip = (al - (p % al)) % al; p = Math.Min(p + skip, end); }
            public byte Byte() { Check(1); return a[p++]; }
            public int I16() { Pad(2); Check(2); int v = a[p] | a[p + 1] << 8; p += 2; return v; }
            public int I32() { Pad(4); Check(4); int v = a[p] | a[p + 1] << 8 | a[p + 2] << 16 | a[p + 3] << 24; p += 4; return v; }
            public uint U32() { return unchecked((uint)I32()); }
            public long I64() { Pad(8); Check(8); long v = 0; for (int i = 7; i >= 0; i--) v = (v << 8) | a[p + i]; p += 8; return v; }
            // The length is a u32 on the wire and an int here, so a desynced
            // stream can present it as negative. Check(n + 1) alone does not
            // catch that: -1 asks it for 0 bytes and passes, and GetString then
            // throws the runtime's ArgumentOutOfRangeException instead of ours.
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
            // The length counts the element data only: the padding between it and
            // the first element is not part of it. Measure the end from where the
            // elements actually start, or every 8-aligned element type (x, t, d,
            // a struct, a variant) reads four bytes short of its own encoding.
            c.Pad(AlignmentOf(elemSig[0]));
            int dataEnd = c.p + len;
            List<object> items = new List<object>();
            while (c.p < dataEnd) items.AddRange(ReadSig(c, elemSig));
            if (c.p != dataEnd) throw new DBusException("matrix: D-Bus array length does not cover its elements");
            // The one array the Konsole calls read back is a list of names: give
            // it the type the callers (and PowerShell) expect to enumerate.
            if (elemSig == "s" || elemSig == "o" || elemSig == "g")
            {
                string[] a = new string[items.Count];
                for (int i = 0; i < items.Count; i++) a[i] = (string)items[i];
                return a;
            }
            return items.ToArray();
        }

        // Header fields this side cares about: 4 the error name, 5 the serial being
        // replied to, 8 the body signature.
        // One little-endian u32 out of raw message bytes: the fixed header's
        // body length, array length and serial. Every reader of message bytes
        // goes through here, so the endianness is spelled once.
        public static uint ReadU32(byte[] m, int off)
        {
            return unchecked((uint)(m[off] | m[off + 1] << 8 | m[off + 2] << 16 | m[off + 3] << 24));
        }

        // Where the body starts, given the header field array's length: the fixed
        // header is 16 bytes, the array follows it, and the body is 8-aligned after
        // that. Spelled once, because the message decoder, the socket reader and
        // the tests' fake bus all have to frame a message the same way.
        public static int BodyStart(int arrLen) { return (16 + arrLen + 7) & ~7; }

        // The spec's ceiling on one message. Both lengths in a header come off
        // the wire, and a call that timed out mid-reply leaves the stream
        // desynced - Invoke-Konsole says so, and Reset-KonsoleBus exists for it -
        // so the next read takes body bytes for a header. Unchecked, a u32 above
        // int.MaxValue casts negative and the arithmetic below lands wherever it
        // lands; a merely enormous one has Bus.ReadMessage allocate it before
        // anything has judged it. Both are the same answer: this is not a message.
        public const uint MAX_MESSAGE = 0x08000000;   // 128 MiB

        public static void CheckLengths(uint bodyLen, uint arrLen)
        {
            if (bodyLen > MAX_MESSAGE || arrLen > MAX_MESSAGE)
                throw new DBusException("matrix: D-Bus message declares an impossible length");
        }

        // One pass over the header field array, handing each field's code and value
        // to the caller. The grammar - a lenient 8-alignment, a byte code, a
        // signature, a value - is spelled here and read by both DecodeMessage and
        // HeaderString. A header array claiming more than the buffer holds ends
        // where the buffer does: the cursor and the loop guard stop together.
        static void WalkFields(byte[] m, int arrLen, Action<byte, object[]> onField)
        {
            int fieldsEnd = Math.Max(16, Math.Min(16 + arrLen, m.Length));
            Cur c = new Cur(m, 16, fieldsEnd - 16);
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
            if (m == null || m.Length < 16) throw new DBusException("matrix: D-Bus message too short");
            if (m[0] != (byte)'l') throw new DBusException("matrix: D-Bus message is not little endian");
            type = m[1];
            CheckLengths(ReadU32(m, 4), ReadU32(m, 12));
            int bodyLen = (int)ReadU32(m, 4);
            int arrLen = (int)ReadU32(m, 12);
            replySerial = 0; errorName = ""; sig = ""; body = new byte[0];

            int bodyStart = BodyStart(arrLen);
            if (bodyStart + bodyLen > m.Length) throw new DBusException("matrix: D-Bus message truncated");
            body = new byte[bodyLen];
            Array.Copy(m, bodyStart, body, 0, bodyLen);

            // The truncation check above already proved the field array fits, so
            // WalkFields' clamp cannot bite here. out parameters cannot be captured.
            uint rs = 0; string en = "", sg = "";
            WalkFields(m, arrLen, delegate(byte code, object[] v)
            {
                if (v.Length == 0) return;
                if (code == 4) en = (string)v[0];
                else if (code == 5) rs = unchecked((uint)Convert.ToInt64(v[0]));
                else if (code == 8) sg = (string)v[0];
            });
            replySerial = rs; errorName = en; sig = sg;
        }

        // The string value of one header field, for the tests' fake bus to read
        // what a client sent it. Returns null when the field is not there.
        public static string HeaderString(byte[] m, byte code)
        {
            if (m == null || m.Length < 16) return null;
            string found = null;
            WalkFields(m, (int)ReadU32(m, 12), delegate(byte f, object[] v)
            {
                if (found == null && f == code && v.Length > 0) found = Convert.ToString(v[0]);
            });
            return found;
        }
    }
}
