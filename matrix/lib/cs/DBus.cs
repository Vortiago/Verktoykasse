namespace MatrixDBus__TAG__
{
    using System;
    using System.Collections.Generic;
    using System.Net.Sockets;
    using System.Runtime.InteropServices;
    using System.Text;

    // The D-Bus session bus, spoken straight over its Unix socket: no client
    // library, no helper binary. Matrix needs it only to drive Konsole - list its
    // tabs, read a tab's process id, switch the window to a tab.
    //
    // A message is a fixed header, an array of (code, variant) fields, and a body.
    // Every value carries an alignment; structs and variants align to 8. One
    // endianness flag covers the whole message, and this side always writes little
    // endian. The codec is next door, in DBusEncode.cs and DBusDecode.cs.

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

    // getuid, and the answer a platform without libc gives instead of throwing.
    // The D-Bus suite compiles this file on Windows and drives the handshake
    // against a fake bus, so an unresolvable P/Invoke would fail the Windows gate.
    // The fake bus reads the uid through here too, so both sides agree.
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

    // One connection to the session bus. It authenticates EXTERNAL (the socket
    // already proves who we are), then trades one method call for one reply,
    // skipping the signals the bus sends in between.
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
                // The address variable can name several buses, and only one need
                // answer. Try the next one.
                catch (Exception e) { last = new DBusException("matrix: session bus handshake failed: " + e.Message); }
            }
            throw last ?? new DBusException("matrix: no usable session bus address");
        }

        // Over a socket the caller already connected. The tests point this at a
        // fake bus on loopback. The handshake is the same.
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
                // The socket exists by the time Connect can fail, and it is ours.
                Dispose();
                throw new DBusException("matrix: cannot reach the session bus: " + e.Message);
            }
            // This ctor owns the socket it dialled. A handshake that throws must not
            // leave it open, or Session() leaks one descriptor per address that did
            // not answer.
            try { Hello(); }
            catch { Dispose(); throw; }
        }

        // The handshake the bus wants before it carries anything: a NUL byte, then
        // EXTERNAL with the uid in hex, then BEGIN, then a Hello method call. The
        // bus does not route for a connection that has not said Hello. It answers
        // that client's first call by closing the socket, which looks like nothing
        // else on this wire.
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
            // through the one message pump. The reply carries our unique name,
            // which nothing here needs.
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
            // Judged before the allocation, not after it.
            Wire.CheckLengths(Wire.ReadU32(head, 4), Wire.ReadU32(head, 12));
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
