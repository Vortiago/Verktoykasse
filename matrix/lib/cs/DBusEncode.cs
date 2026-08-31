namespace MatrixDBus__TAG__
{
    using System;
    using System.Collections.Generic;
    using System.Text;

    // Values and messages onto the wire. The reading half is DBusDecode.cs; the
    // signature grammar and the alignment table here serve both.
    public static partial class Wire
    {
        // --- sizes and alignments ------------------------------------------------

        // The length of the complete type starting at sig[from]: one letter, or an
        // array prefix plus its element. A struct signature needs no slice of its
        // own: WriteSig and ReadSig reject '(' where every other unsupported type
        // is rejected, so measuring it precisely only reaches the same throw.
        static int TypeLen(string sig, int from)
        {
            // 'a' is an array OF something. A signature that stops there is
            // malformed, and it can be: Bus.Call decodes a reply with the
            // signature the reply carried, not the one it asked for.
            if (from >= sig.Length)
                throw new DBusException("matrix: D-Bus signature ends mid-type: " + sig);
            return sig[from] == 'a' ? 1 + TypeLen(sig, from + 1) : 1;
        }

        public static int AlignmentOf(char c)
        {
            switch (c)
            {
                // A variant aligns to 1, not to 8: the specification's table gives
                // the 8 to STRUCT and DICT_ENTRY, and the variant carries its own
                // alignment inside, in the signature it opens with.
                case 'y': case 'g': case 'v': return 1;
                case 'n': case 'q': return 2;
                case 'b': case 'i': case 'u': case 'h': case 's': case 'o': case 'a': return 4;
                default: return 8;    // 'x', 'd', 't'
            }
        }

        // --- writing ---------------------------------------------------------------

        sealed class Buf
        {
            public readonly List<byte> b = new List<byte>(256);
            public int Count { get { return b.Count; } }
            public void Pad(int a) { while (b.Count % a != 0) b.Add(0); }
            public void Byte(byte v) { b.Add(v); }
            public void I16(int v) { Pad(2); b.Add((byte)v); b.Add((byte)(v >> 8)); }
            public void I32(int v) { Pad(4); b.Add((byte)v); b.Add((byte)(v >> 8)); b.Add((byte)(v >> 16)); b.Add((byte)(v >> 24)); }
            public void U32(uint v) { I32(unchecked((int)v)); }
            public void I64(long v) { Pad(8); for (int i = 0; i < 8; i++) b.Add((byte)(v >> (8 * i))); }
            public void Str(string s) { byte[] u = Encoding.UTF8.GetBytes(s); I32(u.Length); b.AddRange(u); b.Add(0); }
            public void Sig(string s) { byte[] u = Encoding.ASCII.GetBytes(s); Byte((byte)u.Length); b.AddRange(u); b.Add(0); }
            public void AddRange(Buf o) { b.AddRange(o.b); }
            public byte[] ToArray() { return b.ToArray(); }
        }

        public static byte[] EncodeBody(string sig, object[] args)
        {
            Buf b = new Buf();
            WriteSig(b, sig, args, 0);
            return b.ToArray();
        }

        // Writes one complete signature, taking values from args[i] onward. Returns
        // the index of the first arg it did not use.
        static int WriteSig(Buf b, string sig, object[] args, int i)
        {
            for (int s = 0; s < sig.Length; s += TypeLen(sig, s))
            {
                object v = (args != null && i < args.Length) ? args[i] : null;
                switch (sig[s])
                {
                    case 'y': b.Byte((byte)v); i++; break;
                    case 'b': b.I32((bool)v ? 1 : 0); i++; break;
                    case 'n': case 'q': b.I16((int)v); i++; break;
                    case 'i': case 'h': case 'u': b.I32(Convert.ToInt32(v)); i++; break;
                    case 'x': case 't': case 'd': b.I64(Convert.ToInt64(v)); i++; break;
                    case 's': case 'o': b.Str((string)v); i++; break;
                    case 'g': b.Sig((string)v); i++; break;
                    case 'v':
                        Variant va = (Variant)v;
                        // No padding of its own: a variant aligns to 1. The value
                        // inside pads to whatever its signature says, from wherever
                        // the signature happens to end.
                        b.Sig(va.Sig);
                        WriteSig(b, va.Sig, new object[] { va.Value }, 0);
                        i++;
                        break;
                    case 'a':
                        string elemSig = sig.Substring(s + 1, TypeLen(sig, s + 1));
                        i = WriteArray(b, elemSig, v, i);
                        break;
                    default:
                        throw new DBusException("matrix: cannot write D-Bus type '" + sig[s] + "'");
                }
            }
            return i;
        }

        // The array length counts the element data, so the elements go into a
        // scratch buffer first, then append as-is at the real element start.
        //
        // That start is aligned to the ELEMENT's own alignment, and offset 0 in the
        // scratch is aligned to everything, so the two agree for every element type
        // whose internal padding never exceeds its own alignment - which is every
        // type these calls send. It does NOT hold for an element that pads harder
        // inside than it aligns outside ('aat', 'av'): the inner 8-alignment would be
        // measured from 0 rather than from a start only 4- or 1-aligned. Nothing here
        // writes one; encoding at the real offset is what it would take.
        static int WriteArray(Buf b, string elemSig, object arrayVal, int i)
        {
            List<object> items = new List<object>();
            if (arrayVal is System.Collections.IEnumerable seq && !(arrayVal is string))
                foreach (object e in seq) items.Add(e);
            else
                items.Add(arrayVal);

            Buf els = new Buf();
            foreach (object e in items)
                WriteSig(els, elemSig, e is object[] many ? many : new object[] { e }, 0);

            b.Pad(4);                                   // the u32 length
            b.U32((uint)els.Count);
            b.Pad(AlignmentOf(elemSig[0]));             // and the first element
            b.AddRange(els);
            return i + 1;                               // the array was one argument
        }

        // One header field: struct(byte code, variant value).
        static void Field(Buf b, byte code, string sig, object value)
        {
            b.Pad(8);
            b.Byte(code);
            b.Sig(sig);
            WriteSig(b, sig, new object[] { value }, 0);
        }

        public static byte[] EncodeCall(uint serial, string dest, string path, string iface,
                                        string member, string inSig, object[] args)
        {
            byte[] body = (string.IsNullOrEmpty(inSig) || args == null)
                ? new byte[0] : EncodeBody(inSig, args);

            Buf fields = new Buf();
            Field(fields, 1, "o", path);
            Field(fields, 6, "s", dest);
            Field(fields, 2, "s", iface);
            Field(fields, 3, "s", member);
            // Off the BODY, not off inSig: a signature the body does not back is a
            // malformed message, and the bus answers one of those by hanging up.
            // `inSig` with a null `args` is exactly that pair.
            if (body.Length > 0) Field(fields, 8, "g", inSig);

            return Pack(1, serial, fields, body);
        }

        // A METHOD_RETURN packing. Production only ever calls, never replies; the
        // tests' fake bus sends these.
        public static byte[] EncodeReply(uint serial, uint replySerial, string outSig, object[] args)
        {
            byte[] body = (string.IsNullOrEmpty(outSig) || args == null)
                ? new byte[0] : EncodeBody(outSig, args);

            Buf fields = new Buf();
            Field(fields, 5, "u", replySerial);
            if (body.Length > 0) Field(fields, 8, "g", outSig);   // see EncodeCall

            return Pack(2, serial, fields, body);
        }

        static byte[] Pack(byte type, uint serial, Buf fields, byte[] body)
        {
            Buf m = new Buf();
            m.Byte((byte)'l');                          // little endian
            m.Byte(type);
            m.Byte(0);                                   // flags
            m.Byte(1);                                  // protocol version
            m.U32((uint)body.Length);
            m.U32(serial);
            m.U32((uint)fields.Count);                   // header array length
            m.AddRange(fields);                         // fields already end 8-aligned
            m.Pad(8);                                   // the body starts 8-aligned
            foreach (byte c in body) m.b.Add(c);
            return m.ToArray();
        }
    }
}
