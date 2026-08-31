namespace MatrixDBus__TAG__
{
    using System;
    using System.Collections.Generic;
    using System.Net.Sockets;
    using System.Runtime.InteropServices;
    using System.Text;

    // The D-Bus session bus, spoken directly over its Unix socket: no client
    // library, no helper binary. Matrix only ever needs it to drive Konsole -
    // list its tabs, read a tab's process id, switch the window to a tab - and
    // that is all this file exists for.
    //
    // The protocol (freedesktop.org, version 1): a message is a fixed header, an
    // array of (code, variant) fields, and a body. Every value carries an
    // alignment; structs and variants align to 8. One endianness flag covers the
    // whole message, and this side always writes little endian.

    public class DBusException : Exception
    {
        public DBusException(string message) : base(message) { }
    }

    // A 'v' value: the signature of what it holds, and the thing itself.
    public sealed class Variant
    {
        public readonly string Sig;
        public readonly object Value;
        public Variant(string sig, object value) { Sig = sig; Value = value; }
    }

    public static class Wire
    {
        // --- sizes and alignments ------------------------------------------------

        // The length of the complete type starting at sig[from]: one letter, or an
        // array prefix plus its element. A struct signature needs no slice of its
        // own: WriteSig and ReadSig reject '(' where every other unsupported type
        // is rejected, so measuring it precisely only reaches the same throw.
        static int TypeLen(string sig, int from)
        {
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

        // --- reading ---------------------------------------------------------------

        sealed class Cur
        {
            readonly byte[] a;
            public int p;
            readonly int end;
            public Cur(byte[] a, int start, int len) { this.a = a; p = start; end = start + len; }
            void Check(int n) { if (p + n > end) throw new DBusException("matrix: truncated D-Bus value"); }
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
            public string Str() { int n = I32(); Check(n + 1); string s = Encoding.UTF8.GetString(a, p, n); p += n + 1; return s; }
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

    // One connection to the session bus. It authenticates EXTERNAL (the socket
    // already proves who we are), then trades one method call for one reply,
    // skipping the signals the bus sends in between.
    // getuid, and the answer a platform without libc gives instead of throwing.
    // Windows has no libc to bind: the D-Bus suite compiles this file there and
    // drives the handshake against a fake bus over loopback, so a P/Invoke that
    // cannot resolve would take the whole Windows gate down. The fake bus reads
    // the uid through here too, so both sides agree on whatever it answers.
    public static class Posix
    {
        [DllImport("libc")]
        private static extern uint getuid();

        public static uint Uid()
        {
            try { return getuid(); }
            catch (DllNotFoundException) { return 0; }
            catch (EntryPointNotFoundException) { return 0; }
        }
    }

    public sealed class Bus : IDisposable
    {
        Socket sock;
        uint serial;

        public static Bus Session()
        {
            string addr = Environment.GetEnvironmentVariable("DBUS_SESSION_BUS_ADDRESS");
            if (string.IsNullOrWhiteSpace(addr))
                addr = "unix:path=/run/user/" + Posix.Uid() + "/bus";    // the systemd user bus
            DBusException last = null;
            foreach (string one in addr.Split(';'))
            {
                if (string.IsNullOrWhiteSpace(one)) continue;
                try { return new Bus(one); }
                catch (DBusException e) { last = e; }
                // A socket timeout or a peer that hangs up mid-handshake is a
                // reason to try the next address, not to abandon the list: the
                // address variable can name several, and only one need answer.
                catch (Exception e) { last = new DBusException("matrix: session bus handshake failed: " + e.Message); }
            }
            throw last ?? new DBusException("matrix: no usable session bus address");
        }

        // Over a socket the caller already connected - the tests point this at a
        // fake bus on a loopback socket. The handshake is the same one.
        public Bus(Socket connected)
        {
            sock = connected;
            sock.ReceiveTimeout = sock.SendTimeout = 10000;
            Hello();
        }

        Bus(string addr)
        {
            if (!addr.StartsWith("unix:", StringComparison.Ordinal))
                throw new DBusException("matrix: unsupported bus address: " + addr);
            string path = null, abstractName = null;
            foreach (string kv in addr.Substring(5).Split(','))
            {
                int eq = kv.IndexOf('=');
                if (eq < 0) continue;
                if (kv.Substring(0, eq) == "path") path = kv.Substring(eq + 1);
                else if (kv.Substring(0, eq) == "abstract") abstractName = kv.Substring(eq + 1);
            }
            if (path == null && abstractName == null)
                throw new DBusException("matrix: bus address names no socket: " + addr);
            try
            {
                sock = new Socket(AddressFamily.Unix, SocketType.Stream, ProtocolType.Unspecified);
                sock.ReceiveTimeout = sock.SendTimeout = 10000;
                sock.Connect(path != null ? new UnixDomainSocketEndPoint(path)
                                          : new UnixDomainSocketEndPoint("\0" + abstractName));
            }
            catch (Exception e)
            {
                // The socket exists by the time Connect can fail, and it is ours:
                // close it here for the same reason the handshake below does.
                Dispose();
                throw new DBusException("matrix: cannot reach the session bus: " + e.Message);
            }
            // This ctor owns the socket it dialled: a handshake that throws must
            // not leave it open, or a Session() walking several addresses leaks
            // one file descriptor per address that did not answer.
            try { Hello(); }
            catch { Dispose(); throw; }
        }

        // The handshake the bus wants before it will carry anything: a NUL byte,
        // then EXTERNAL with the uid hex-encoded, then BEGIN - and then the
        // org.freedesktop.DBus.Hello method call, on the wire, as the first
        // message. The bus does not route for a connection that has not said
        // Hello: it answers such a client's first call by closing the socket,
        // a failure that sits on the far side of the wire and looks like nothing
        // else. The reply carries the unique name it assigned us, which we have
        // no use for - but the exchange has to complete before the first real
        // call goes out.
        void Hello()
        {
            Send(new byte[] { 0 });
            string uidHex = BitConverter.ToString(Encoding.ASCII.GetBytes(Posix.Uid().ToString()))
                                         .Replace("-", "");
            Send(Encoding.ASCII.GetBytes("AUTH EXTERNAL " + uidHex + "\r\n"));
            string line = ReadLine();
            if (!line.StartsWith("OK", StringComparison.Ordinal))
                throw new DBusException("matrix: session bus refused EXTERNAL auth: " + line);
            Send(Encoding.ASCII.GetBytes("BEGIN\r\n"));

            // Hello is an ordinary method call once BEGIN has gone out, so it goes
            // through the one message pump: the same serial, the same skipping of
            // the signals the bus interleaves, the same error reply turned into a
            // throw. The reply carries our unique name, which we have no use for.
            Call("org.freedesktop.DBus", "/org/freedesktop/DBus",
                 "org.freedesktop.DBus", "Hello", "", null, "s");
        }

        string ReadLine()
        {
            List<byte> b = new List<byte>();
            byte[] one = new byte[1];
            for (; ; )
            {
                int n = sock.Receive(one, 1, SocketFlags.None);
                if (n <= 0) throw new DBusException("matrix: session bus closed during auth");
                if (one[0] == (byte)'\n') return Encoding.UTF8.GetString(b.ToArray()).TrimEnd('\r');
                b.Add(one[0]);
            }
        }

        public object[] Call(string dest, string path, string iface, string member,
                             string inSig, object[] args, string outSig)
        {
            uint ser = ++serial;
            Send(Wire.EncodeCall(ser, dest, path, iface, member, inSig, args));
            for (; ; )
            {
                byte[] m = ReadMessage();
                byte type; uint reply; string err, sig; byte[] body;
                Wire.DecodeMessage(m, out type, out reply, out err, out sig, out body);
                if ((type != 2 && type != 3) || reply != ser) continue;
                if (type == 3)
                    throw new DBusException(err + ": " +
                        (sig == "s" ? (string)Wire.DecodeValues(body, "s")[0] : "the call failed"));
                return Wire.DecodeValues(body, string.IsNullOrEmpty(sig) ? (outSig ?? "") : sig);
            }
        }

        byte[] ReadMessage()
        {
            byte[] head = ReadExact(16);
            int bodyLen = (int)Wire.ReadU32(head, 4);
            int arrLen = (int)Wire.ReadU32(head, 12);
            byte[] m = new byte[Wire.BodyStart(arrLen) + bodyLen];
            Array.Copy(head, m, 16);
            if (m.Length > 16) ReadExactInto(m, 16);
            return m;
        }

        byte[] ReadExact(int n)
        {
            byte[] b = new byte[n];
            ReadExactInto(b, 0);
            return b;
        }

        void ReadExactInto(byte[] b, int offset)
        {
            int end = b.Length;
            for (int got = offset; got < end; )
            {
                int k = sock.Receive(b, got, end - got, SocketFlags.None);
                if (k <= 0) throw new DBusException("matrix: session bus closed");
                got += k;
            }
        }

        void Send(byte[] b)
        {
            for (int off = 0; off < b.Length; )
            {
                int k = sock.Send(b, off, b.Length - off, SocketFlags.None);
                if (k <= 0) throw new DBusException("matrix: session bus closed");
                off += k;
            }
        }

        public void Dispose()
        {
            if (sock != null)
            {
                try { sock.Close(); } catch { }
                sock = null;
            }
        }
    }
}
