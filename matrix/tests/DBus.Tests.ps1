# The D-Bus wire codec behind the Konsole integration, byte by byte. The codec is
# pure: everything here marshals and unmarshals buffers, no bus involved. The
# goldens are hand-packed from the D-Bus specification (little endian, version 1),
# not read back out of the encoder - an encoder that agrees with itself proves
# nothing.
#
# This file compiles DBus.cs standalone, so it also covers Windows CI, where
# types.ps1 does not select DBus.cs at all.
BeforeAll {
    . (Join-Path $PSScriptRoot '../lib/console.ps1')
    . (Join-Path $PSScriptRoot 'Fixtures.ps1')

    # fake-bus.cs reopens the same tagged namespace, so it compiles as one unit
    # with the client it judges.
    $wire, $variant, $fake, $bus = @(Import-TestCsType `
        @((Join-Path $PSScriptRoot '../lib/cs/DBus.cs'), (Join-Path $PSScriptRoot 'fake-bus.cs')) `
        @('MatrixDBus{0}.Wire', 'MatrixDBus{0}.Variant', 'MatrixDBus{0}.FakeBus', 'MatrixDBus{0}.Bus'))
    $script:Wire    = $wire
    $script:Variant = $variant
    $script:Fake    = $fake
    $script:Bus     = $bus

    # Defined in BeforeAll, like every helper in the other suites: file-level
    # functions are not visible inside It blocks under Pester 5.
    function Get-Hex ([byte[]] $Bytes) { [BitConverter]::ToString($Bytes) }
}

Describe 'Wire: body encoding' {
    It 'packs an int32 little endian' {
        Get-Hex ($Wire::EncodeBody('i', @(42))) | Should -Be '2A-00-00-00'
    }

    It 'packs a string as length, bytes, NUL' {
        Get-Hex ($Wire::EncodeBody('s', @('hi'))) | Should -Be '02-00-00-00-68-69-00'
    }

    It 'pads a field to the next field alignment' {
        # int32 then string: nothing to pad (4 is already 4-aligned), the point is
        # the layout is exactly these bytes in this order.
        Get-Hex ($Wire::EncodeBody('is', @(1, 'ab'))) | Should -Be '01-00-00-00-02-00-00-00-61-62-00'
    }

    It 'packs a uint32' {
        Get-Hex ($Wire::EncodeBody('u', @([uint32]0x01020304))) | Should -Be '04-03-02-01'
    }

    It 'packs an int64' {
        Get-Hex ($Wire::EncodeBody('x', @([int64]1))) | Should -Be '01-00-00-00-00-00-00-00'
    }

    It 'packs a byte without padding' {
        Get-Hex ($Wire::EncodeBody('y', @([byte]0x41))) | Should -Be '41'
    }

    It 'packs a string array with its byte length' {
        # array: u32 length of the element data, then the elements, each aligned
        # to its own type: 'a' is 4 + 2 = 6 bytes, the next length u32 pads to
        # offset 8, then 'bc' is 4 + 3 = 7 more: 15 bytes in all.
        # The comma keeps PowerShell from unwrapping the array into two arguments:
        # 'as' consumes ONE argument, the whole array.
        Get-Hex ($Wire::EncodeBody('as', (, [string[]]@('a', 'bc')))) |
            Should -Be '0F-00-00-00-01-00-00-00-61-00-00-00-02-00-00-00-62-63-00'
    }

    It 'packs an array argument without eating the argument after it' {
        # 'a' consumes its one argument and moves on: the int32 after the array
        # reads the next argument, not the array again.
        Get-Hex ($Wire::EncodeBody('asi', @([string[]]@('a'), 5))) |
            Should -Be '06-00-00-00-01-00-00-00-61-00-00-00-05-00-00-00'
    }

    It 'pads an array to element alignment after a byte' {
        # byte then string array: the u32 length must sit at offset 4, so the array
        # container pads after the byte. Array data itself is 4-aligned already.
        Get-Hex ($Wire::EncodeBody('yas', @([byte]7, [string[]]@('a')))) |
            Should -Be '07-00-00-00-06-00-00-00-01-00-00-00-61-00'
    }

    It 'packs a variant as a signature followed by its value' {
        # variant: signature 'i' (length, chars, NUL), then the value padded to its
        # own alignment. Signature is 3 bytes, so the int32 pads from offset 3 to 4.
        Get-Hex ($Wire::EncodeBody('v', @($Variant::new('i', 5)))) | Should -Be '01-69-00-00-05-00-00-00'
    }

    It 'pads a variant value to its own alignment' {
        # signature 'x' is 3 bytes; an int64 aligns to 8.
        Get-Hex ($Wire::EncodeBody('v', @($Variant::new('x', [int64]1)))) |
            Should -Be '01-78-00-00-00-00-00-00-01-00-00-00-00-00-00-00'
    }

    It 'does not pad the variant itself, which aligns to one' {
        # The specification gives the 8 to STRUCT and DICT_ENTRY; a VARIANT aligns to
        # 1. A variant at offset 0 - which is what every other case here writes -
        # cannot tell the two apart. Put a byte in front of it and it can: the
        # signature must start at offset 1, not at 8. Getting this wrong is invisible
        # in a round trip and rejected by the bus, e.g. Properties.Set ("ssv").
        Get-Hex ($Wire::EncodeBody('yv', @([byte]1, $Variant::new('i', 5)))) |
            Should -Be '01-01-69-00-05-00-00-00'
    }
}

Describe 'Wire: body decoding' {
    It 'round-trips a string' {
        $Wire::DecodeValues(($Wire::EncodeBody('s', @('zepp4lin'))), 's') | Should -Be 'zepp4lin'
    }

    It 'round-trips an int32' {
        $Wire::DecodeValues(($Wire::EncodeBody('i', @(-1234))), 'i') | Should -Be -1234
    }

    It 'round-trips a string array' {
        # The decoded array comes back as a typed string[] (see ReadArray). The
        # @() re-enumerates it, so Should sees two strings next to a two-string
        # expectation - a nested array piped in whole does not compare equal.
        $out = $Wire::DecodeValues(($Wire::EncodeBody('as', (, [string[]]@('one', 'two')))), 'as')
        ($out[0] -is [string[]]) | Should -BeTrue
        @($out[0]) | Should -Be @('one', 'two')
    }

    It 'round-trips an array whose elements align to eight' {
        # The u32 length counts the element data, NOT the padding between it and
        # the first element. A reader that measures the end from before that
        # padding stops four bytes short of every int64, struct or variant array
        # and calls the encoder's own bytes malformed.
        # Hand-packed: length 16, four bytes of padding, then the two int64s.
        $bytes = $Wire::EncodeBody('at', (, [int64[]]@(1, 2)))
        Get-Hex $bytes | Should -Be ('10-00-00-00-00-00-00-00-' +
            '01-00-00-00-00-00-00-00-02-00-00-00-00-00-00-00')
        $out = $Wire::DecodeValues($bytes, 'at')
        @($out[0]) | Should -Be @([int64]1, [int64]2)
    }

    It 'round-trips an empty array of eight-aligned elements' {
        # Zero elements still carry the padding, so the shortest 'at' body is the
        # length and four zero bytes. The end must land on the length, not before it.
        $bytes = $Wire::EncodeBody('at', (, [int64[]]@()))
        Get-Hex $bytes | Should -Be '00-00-00-00-00-00-00-00'
        @($Wire::DecodeValues($bytes, 'at')[0]) | Should -HaveCount 0
    }

    It 'round-trips a variant, signature and value apart' {
        $out = $Wire::DecodeValues(($Wire::EncodeBody('v', @($Variant::new('i', 5)))), 'v')
        $out[0].Sig   | Should -Be 'i'
        $out[0].Value | Should -Be 5
    }

    It 'round-trips a signature type' {
        $out = $Wire::DecodeValues(($Wire::EncodeBody('g', @('as'))), 'g')
        $out[0] | Should -Be 'as'
    }

    It 'reads the buffer it is given and nothing more' {
        # A body length shorter than the array it sits in: the reader must stop at
        # the signature, not run off the end.
        $bytes = [byte[]](2, 0, 0, 0, 0x61, 0x62, 0x00, 0xFF, 0xFF)
        $Wire::DecodeValues($bytes, 's') | Should -Be 'ab'
    }
}

Describe 'Wire: method call header' {
    It 'packs the fixed header and the four required fields' {
        $bytes = $Wire::EncodeCall(7, ':1.2', '/W/1', 'o.k.W', 'm', '', $null)
        # little endian, METHOD_CALL, no flags, version 1; empty body; serial 7;
        # header array of 58 bytes.
        Get-Hex $bytes[0..15] | Should -Be '6C-01-00-01-00-00-00-00-07-00-00-00-3A-00-00-00'
        # The body starts 8-aligned after the header array: 16 + 58 pads to 80.
        $bytes.Length | Should -Be 80
    }

    It 'carries the signature and the body when there are arguments' {
        $bytes = $Wire::EncodeCall(1, ':1.2', '/W/1', 'o.k.W', 'm', 'i', @(9))
        # The body length sits at offset 4, right after the four flag bytes.
        $bytes[4..7] | Should -Be @(4, 0, 0, 0) -Because 'body length is 4'
        $Wire::DecodeValues($bytes[($bytes.Length - 4)..($bytes.Length - 1)], 'i') | Should -Be 9
    }
}

Describe 'Wire: message decoding' {
    BeforeAll {
        # A METHOD_RETURN, packed by hand: reply_serial 7, signature 's', body 'ok'.
        #  16: field 5 (REPLY_SERIAL, 'u'): 05 | 01 'u' 00 | 07 00 00 00
        #  32: field 8 (SIGNATURE, 'g'):   08 | 01 'g' 00 | 01 's' 00
        #  40: body 'ok'
        # Each field is a struct, so the second one starts 8-aligned: 24 pads to 32.
        $script:ret = [byte[]]@(
            0x6C, 2, 1, 1,              # 'l', METHOD_RETURN, no-reply-expected, version 1
            7, 0, 0, 0,                 # body length
            99, 0, 0, 0,                # serial
            23, 0, 0, 0,                # header array length
            5, 1, 0x75, 0, 7, 0, 0, 0,          # 16..23: REPLY_SERIAL = 7
            0, 0, 0, 0, 0, 0, 0, 0,            # 24..31: pad to 8
            8, 1, 0x67, 0, 1, 0x73, 0,          # 32..38: SIGNATURE = "s"
            0,                                    # 39: pad to 8
            2, 0, 0, 0, 0x6F, 0x6B, 0             # 40..46: body: 'ok'
        )
    }

    It 'reads the reply serial and the body signature' {
        $type = 0; $reply = [uint32]0; $sig = ''; $body = $null; $err = ''
        $Wire::DecodeMessage($script:ret, [ref]$type, [ref]$reply, [ref]$err, [ref]$sig, [ref]$body)
        $type   | Should -Be 2
        $reply  | Should -Be 7
        $err    | Should -Be ''
        $sig    | Should -Be 's'
        $Wire::DecodeValues($body, $sig) | Should -Be 'ok'
    }

    It 'carries the error name out of an error reply' {
        # field 4 (ERROR_NAME, 's') = 'e.x' at 16, field 5 (REPLY_SERIAL) = 7 at 32,
        # body 'oops' at 40. 16 + 24 = 40 is already 8-aligned, so no pad before it.
        $bad = [byte[]]@(
            0x6C, 3, 1, 1,
            9, 0, 0, 0,                 # body length: 'oops' as a string
            5, 0, 0, 0,                 # serial
            24, 0, 0, 0,                # header array length
            4, 1, 0x73, 0, 3, 0, 0, 0, 0x65, 0x2E, 0x78, 0,   # 16..27: ERROR_NAME = "e.x"
            0, 0, 0, 0,                                        # 28..31: pad to 8
            5, 1, 0x75, 0, 7, 0, 0, 0,                         # 32..39: REPLY_SERIAL = 7
            4, 0, 0, 0, 0x6F, 0x6F, 0x70, 0x73, 0              # 40..48: body: 'oops'
        )
        $type = 0; $reply = [uint32]0; $sig = ''; $body = $null; $err = ''
        $Wire::DecodeMessage($bad, [ref]$type, [ref]$reply, [ref]$err, [ref]$sig, [ref]$body)
        $err | Should -Be 'e.x'
        $Wire::DecodeValues($body, 's') | Should -Be 'oops'
    }

    It 'reads back what the call encoder wrote' {
        $bytes = $Wire::EncodeCall(7, ':1.2', '/W/1', 'o.k.W', 'm', 'i', @(5))
        $type = 0; $reply = [uint32]0; $sig = ''; $body = $null; $err = ''
        $Wire::DecodeMessage($bytes, [ref]$type, [ref]$reply, [ref]$err, [ref]$sig, [ref]$body)
        $type  | Should -Be 1
        $reply | Should -Be 0                        # a call has no reply serial
        $sig   | Should -Be 'i'
        $Wire::DecodeValues($body, $sig) | Should -Be 5
    }
}

Describe 'Bus: the session bus handshake' {
    # Judged against a fake bus on a loopback socket, not against this machine's
    # real one: the suite runs on CI runners with no D-Bus at all. The fake is
    # strict exactly where the real bus is - see fake-bus.cs.
    It 'calls org.freedesktop.DBus.Hello right after SASL, before anything else' {
        # The bus will not carry traffic for a connection that has not said Hello.
        # A client that stops at the SASL handshake authenticates fine and then
        # loses the socket on its very first call: the bus answers by closing.
        # That failure lived on the other side of the wire, invisible to any
        # in-process test - hence the fake.
        $fake = $Fake::new()
        $fake.Start()
        $client = [System.Net.Sockets.TcpClient]::new('127.0.0.1', $fake.Port)
        $bus = $Bus::new($client.Client)
        $bus.Dispose()
        $fake.Dispose()

        $fake.Failure    | Should -Be '' -Because 'the fake bus expected the standard handshake'
        $fake.FirstMember | Should -Be 'Hello'
        $fake.FirstIface  | Should -Be 'org.freedesktop.DBus'
        $fake.FirstPath   | Should -Be '/org/freedesktop/DBus'
    }

    It 'numbers the calls after the Hello, and reads their replies' {
        # Hello is serial 1; the first real call must not reuse the number.
        $fake = $Fake::new()
        $fake.Start()
        $client = [System.Net.Sockets.TcpClient]::new('127.0.0.1', $fake.Port)
        $bus = $Bus::new($client.Client)
        $answer = $bus.Call(':1.99', '/X', 'i.m', 'method', '', $null, 's')
        $bus.Dispose()
        $fake.Dispose()

        $fake.Failure     | Should -Be ''
        $fake.SecondMember | Should -Be 'method'
        $answer[0]         | Should -Be 'ok'
    }
}
