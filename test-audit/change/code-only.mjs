// A code-only view of source text: comments are blanked, and the contents of
// strings, templates, and regular expressions are blanked, with every offset
// preserved. A scanner then sees code, not a `test(...)` or a `.skip` written
// inside a fixture string, a regex, or a comment.
//
// The delimiters of a literal are kept, so `argSpan`'s own string-skipping still
// works on this view. A regex literal is recognised by the character before its
// opening slash, the usual heuristic: after an operator, a bracket, a comma, or
// a keyword that expects an expression. A `/` that follows a value is division.

const REGEX_KEYWORDS = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "do", "else", "case", "yield", "await", "throw"]);
const REGEX_PUNCTUATION = "(,=:[!&|?{};+-*%^~<>";

/**
 * @param {string} text
 * @returns {string} the same bytes, with literal and comment bodies blanked.
 */
export function codeOnly(text) {
  let out = "";
  /** @type {Array<{ type: "string", quote: string } | { type: "template" } | { type: "regex", inClass: boolean } | { type: "interp", depth: number }>} */
  const stack = [];
  const top = () => stack[stack.length - 1];
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    const next = text[i + 1];
    const frame = top();
    if (frame && frame.type === "string") {
      if (char === "\\") {
        out += "  ";
        i += 2;
        continue;
      }
      if (char === frame.quote || (frame.quote !== "`" && char === "\n")) {
        out += char;
        stack.pop();
        i += 1;
        continue;
      }
      out += " ";
      i += 1;
      continue;
    }
    if (frame && frame.type === "template") {
      if (char === "\\") {
        out += "  ";
        i += 2;
        continue;
      }
      if (char === "`") {
        out += char;
        stack.pop();
        i += 1;
        continue;
      }
      if (char === "$" && next === "{") {
        out += "${";
        stack.push({ type: "interp", depth: 0 });
        i += 2;
        continue;
      }
      out += " ";
      i += 1;
      continue;
    }
    if (frame && frame.type === "regex") {
      if (char === "\\") {
        out += "  ";
        i += 2;
        continue;
      }
      if (char === "[") frame.inClass = true;
      else if (char === "]" && frame.inClass) frame.inClass = false;
      else if (char === "/" && !frame.inClass) {
        out += char;
        stack.pop();
        i += 1;
        continue;
      } else if (char === "\n") {
        out += char;
        stack.pop();
        i += 1;
        continue;
      }
      out += " ";
      i += 1;
      continue;
    }
    // Code context, or the inside of a `${…}` interpolation.
    if (char === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") {
        out += " ";
        i += 1;
      }
      continue;
    }
    if (char === "/" && next === "*") {
      out += "  ";
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
        out += text[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      if (i < text.length) {
        out += "  ";
        i += 2;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      out += char;
      stack.push({ type: "string", quote: char });
      i += 1;
      continue;
    }
    if (char === "`") {
      out += char;
      stack.push({ type: "template" });
      i += 1;
      continue;
    }
    if (char === "/" && canStartRegex(out, next)) {
      out += char;
      stack.push({ type: "regex", inClass: false });
      i += 1;
      continue;
    }
    if (frame && frame.type === "interp" && (char === "{" || char === "}")) {
      if (char === "{") frame.depth += 1;
      else if (frame.depth === 0) stack.pop();
      else frame.depth -= 1;
    }
    out += char;
    i += 1;
  }
  return out;
}

/**
 * Does a `/` at this point open a regex? Look back over the code emitted so
 * far: after a value (identifier, number, closing bracket) a slash is division.
 * A wrong "yes" blanks the rest of the line, its `)` with it, and the test is
 * lost, so JSX tag ends (`</div>`, `</>`, `={x} />`) and postfix operators
 * (`i++ /`, TypeScript's `total! /`) are read as what they are.
 * @param {string} out
 * @param {string | undefined} next the character after the `/`
 */
function canStartRegex(out, next) {
  let end = out.length - 1;
  if (out[end] === "<") return false;
  while (end >= 0 && /\s/.test(out[end])) end -= 1;
  if (end < 0) return true;
  const char = out[end];
  if (char === "}" && next === ">") return false;
  if ("+-!".includes(char) && isPostfix(out, end)) return false;
  if (REGEX_PUNCTUATION.includes(char)) return true;
  if (!/[\w$]/.test(char)) return false;
  let start = end;
  while (start >= 0 && /[\w$]/.test(out[start])) start -= 1;
  // A keyword read as a property (`stats.new / x`, `opts?.in / 2`) is a value.
  if (out[start] === ".") return false;
  return REGEX_KEYWORDS.has(out.slice(start + 1, end + 1));
}

/**
 * Is the operator ending at `end` a postfix one (`i++`, `i--`, TypeScript's
 * non-null `total!`)? Then a value precedes the `/`, and the slash is division.
 * @param {string} out @param {number} end
 */
function isPostfix(out, end) {
  const char = out[end];
  const before = char === "!" ? end - 1 : out[end - 1] === char ? end - 2 : -1;
  return before >= 0 && /[\w$)\]]/.test(out[before]);
}
