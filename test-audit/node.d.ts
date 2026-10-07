// The slice of the Node API that the test-audit modules use, declared by hand so
// that the tsc gate needs no @types/node, no package.json, and no install: the
// gate stays `node tools/check.mjs` on a clean checkout, offline once npx has
// typescript@5 cached. Each signature is a subset of the real one in
// @types/node, so code that checks here also checks against the full types.
// A module that starts to use another Node API adds its signature here; tsc
// reports the missing name until it does.
//
// No `import` or `export` at the top level: this file is a global script, so its
// `declare module` blocks and globals apply to every file in the program.

// ── globals ────────────────────────────────────────────────────────────────

interface ImportMeta {
  /** The `file:` URL of the current module. */
  readonly url: string;
}

interface NodeProcess {
  argv: string[];
  env: Record<string, string | undefined>;
  exitCode?: number;
  cwd(): string;
  stderr: { write(chunk: string): boolean };
}

declare var process: NodeProcess;

declare var console: {
  log(...data: unknown[]): void;
  error(...data: unknown[]): void;
};

/** The callback takes no argument, so a promise's `resolve` fits as well. */
declare function setTimeout(callback: (_: void) => void, ms?: number): unknown;

declare class URL {
  constructor(url: string, base?: string | URL);
  readonly href: string;
  readonly protocol: string;
}

interface Buffer {
  toString(encoding: "utf8"): string;
}

declare var Buffer: {
  byteLength(text: string): number;
  concat(chunks: Buffer[]): Buffer;
};

interface AbortSignal {
  readonly aborted: boolean;
}

declare var AbortSignal: {
  timeout(ms: number): AbortSignal;
};

interface FetchResponse {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
  /** `unknown`, as in @types/node: the caller states the shape it expects. */
  json(): Promise<unknown>;
}

declare function fetch(
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
): Promise<FetchResponse>;

// ── node:* modules ─────────────────────────────────────────────────────────

/** The slice of node:http and node:https that a JSON POST and a test server use. */
interface NodeIncomingMessage {
  readonly statusCode?: number;
  on(event: "data", listener: (chunk: Buffer) => void): this;
  on(event: "end", listener: () => void): this;
  on(event: "error", listener: (err: Error) => void): this;
}

interface NodeClientRequest {
  on(event: "error", listener: (err: Error) => void): this;
  end(body?: string): this;
}

type NodeRequest = (
  url: URL,
  options: { method?: string; headers?: Record<string, string | number>; signal?: AbortSignal },
  callback: (res: NodeIncomingMessage) => void,
) => NodeClientRequest;

declare module "node:http" {
  export const request: NodeRequest;
  interface ServerResponse {
    writeHead(status: number, headers?: Record<string, string>): this;
    end(body?: string): this;
  }
  interface Server {
    listen(port: number, host: string, callback: () => void): this;
    address(): unknown;
    close(): this;
  }
  export function createServer(handler: (req: NodeIncomingMessage, res: ServerResponse) => void): Server;
}

declare module "node:https" {
  export const request: NodeRequest;
}

declare module "node:net" {
  export interface AddressInfo {
    port: number;
  }
}

declare module "node:process" {
  const process: NodeProcess;
  export default process;
}

declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function readdirSync(path: string): string[];
  export function readdirSync(path: string, options: { withFileTypes: true }): Array<{ name: string; isDirectory(): boolean }>;
  export function existsSync(path: string): boolean;
  export function appendFileSync(path: string, data: string): void;
  export function globSync(pattern: string, options: { cwd?: string | URL }): string[];
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
}

declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}

declare module "node:child_process" {
  export interface SpawnSyncReturns {
    status: number | null;
    stdout: string;
    stderr: string;
    error?: Error;
  }
  export function spawnSync(
    command: string,
    args: readonly string[],
    options: { cwd?: string; encoding: "utf8"; maxBuffer?: number },
  ): SpawnSyncReturns;
}

declare module "node:util" {
  /** One option of `parseArgs`. `multiple` is not used, so it is not declared. */
  interface ParseArgsOption {
    type: "string" | "boolean";
    short?: string;
    default?: string | boolean;
  }
  type ParseArgsValue<O extends ParseArgsOption> = O["type"] extends "boolean" ? boolean : string;
  /** As in @types/node: an option with a `default` is always set; any other may be absent. */
  type ParseArgsValues<T extends Record<string, ParseArgsOption>> = {
    -readonly [K in keyof T]?: ParseArgsValue<T[K]>;
  } & {
    -readonly [K in keyof T as T[K]["default"] extends {} ? K : never]: ParseArgsValue<T[K]>;
  };
  export function parseArgs<T extends Record<string, ParseArgsOption>>(config: {
    args?: string[];
    options: T;
    allowPositionals?: boolean;
  }): { values: ParseArgsValues<T>; positionals: string[] };
}

declare module "node:test" {
  export function test(name: string, fn: () => void | Promise<void>): Promise<void>;
}

declare module "node:assert/strict" {
  interface Assert {
    ok(value: unknown, message?: string | Error): asserts value;
    equal<T>(actual: unknown, expected: T, message?: string | Error): asserts actual is T;
    deepEqual<T>(actual: unknown, expected: T, message?: string | Error): asserts actual is T;
    match(value: string, regExp: RegExp, message?: string | Error): void;
    doesNotMatch(value: string, regExp: RegExp, message?: string | Error): void;
    throws(block: () => unknown, error?: RegExp, message?: string | Error): void;
    rejects(promise: Promise<unknown>, error?: RegExp, message?: string | Error): Promise<void>;
  }
  const assert: Assert;
  export default assert;
}
