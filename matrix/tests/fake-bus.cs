// A session bus with just enough protocol to sit on the other end of a loopback
// socket and record what a client does. The Pester tests own this file; the
// production code talks to the real bus, which cannot run inside the suite.
//
// It is deliberately strict about the one thing that broke the real client:
// the first message a client sends after SASL. The real dbus-daemon and
// dbus-broker answer a connection that speaks before saying Hello by closing
// the socket, so this fake records that first message for the test to judge.
namespace MatrixDBus__TAG__
{
    using System;
    using System.Collections.Generic;
    using System.Net;
    using System.Net.Sockets;
    using System.Text;
    using System.Threading;

    public sealed class FakeBus : IDisposable
    {
        // The client hex-encodes its own uid for EXTERNAL auth; the expected
        // line must be built the same way, not guessed as a literal, or every
        // machine whose uid is not 1000 fails the test.
        static string ExpectedAuth()
        {
            string uid = Posix.Uid().ToString();
            byte[] ascii = Encoding.ASCII.GetBytes(uid);
            string hex = BitConverter.ToString(ascii).Replace("-", "");
            return "AUTH EXTERNAL " + hex;
        }

        public string FirstPath = "";
        public string FirstIface = "";
        public string FirstMember = "";
        public string SecondMember = "";
        public string Failure = "";
        public int Port;

        volatile bool stopping;
        TcpListener listener;
        Socket peer;
        Thread thread;

        public void Start()
        {
            listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            Port = ((IPEndPoint)listener.LocalEndpoint).Port;
            thread = new Thread(Run) { IsBackground = true };
            thread.Start();
        }

        public void Dispose()
        {
            stopping = true;
            try { listener.Stop(); } catch { }
            try { if (peer != null) peer.Close(); } catch { }
            thread.Join(5000);
        }

        void Fail(string why) { Failure = why; }

        void Run()
        {
            try
            {
                peer = listener.AcceptSocket();
                if (ReadByte() != 0) { Fail("the connection did not begin with a NUL byte"); return; }
                string auth = ReadLine();
                if (auth != ExpectedAuth())
                { Fail("no AUTH EXTERNAL with the hex uid was sent: " + auth); return; }
                Send(Encoding.ASCII.GetBytes("OK 0123456789abcdef0123456789abcdef\r\n"));
                if (ReadLine() != "BEGIN") { Fail("no BEGIN after the auth OK"); return; }

                // The message the whole test exists to see. A real bus closes the
                // connection in place of replying to a client that skips it.
                byte[] first = ReadMessage(peer);
                if (first == null) { Fail("the client sent no message after BEGIN"); return; }
                FirstPath = Wire.HeaderString(first, 1) ?? "";
                FirstIface = Wire.HeaderString(first, 2) ?? "";
                FirstMember = Wire.HeaderString(first, 3) ?? "";
                if (first[1] != 1) { Fail("the first message is not a method call"); return; }
                Send(Wire.EncodeReply(1, SerialOf(first), "s", new object[] { ":1.99" }));

                // Whatever comes next, if anything: reply the same way, so a Call
                // made after the handshake completes and the test can judge both.
                byte[] second = ReadMessage(peer);
                if (second == null) return;
                SecondMember = Wire.HeaderString(second, 3) ?? "";
                Send(Wire.EncodeReply(2, SerialOf(second), "s", new object[] { "ok" }));
            }
            catch (Exception e)
            {
                if (!stopping) Fail(e.Message);
            }
            finally
            {
                try { if (peer != null) peer.Close(); } catch { }
            }
        }

        static uint SerialOf(byte[] m) { return Wire.ReadU32(m, 8); }

        byte ReadByte()
        {
            byte[] one = new byte[1];
            return peer.Receive(one) == 1 ? one[0] : (byte)0;
        }

        void Send(byte[] b) { peer.Send(b); }

        string ReadLine()
        {
            List<byte> line = new List<byte>();
            for (; ; )
            {
                byte[] one = new byte[1];
                if (peer.Receive(one) <= 0) return "\0closed";
                if (one[0] == (byte)'\n') return Encoding.UTF8.GetString(line.ToArray()).TrimEnd('\r');
                line.Add(one[0]);
            }
        }

        static byte[] ReadMessage(Socket s)
        {
            byte[] head = new byte[16];
            if (!Fill(s, head, 0)) return null;
            int bodyLen = (int)Wire.ReadU32(head, 4);
            int arrLen = (int)Wire.ReadU32(head, 12);
            byte[] m = new byte[Wire.BodyStart(arrLen) + bodyLen];
            Array.Copy(head, m, 16);
            return Fill(s, m, 16) ? m : null;
        }

        static bool Fill(Socket s, byte[] b, int from)
        {
            int p = from;
            while (p < b.Length)
            {
                int n = s.Receive(b, p, b.Length - p, SocketFlags.None);
                if (n <= 0) return false;
                p += n;
            }
            return true;
        }
    }
}
