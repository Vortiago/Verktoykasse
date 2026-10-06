// An OpenCode 2 plugin that runs test-audit on the tests a change adds. It adds
// a /test-audit command and a test-audit tool, both advisory: they report the
// per-test verdict, and they never block a run. The classifier itself is the
// test-audit directory one level up, which this plugin ships with. See
// ../README.md.
import { Plugin } from "@opencode/plugin"
import { runAudit } from "../audit.mjs"
import { formatAudit } from "../report/index.mjs"

interface AuditArgs {
  base?: string
  head?: string
  staged?: boolean
  files?: string[]
}

/** The markdown report for one audit. */
async function report(directory: string, args: AuditArgs): Promise<string> {
  const audit = await runAudit(args, { cwd: directory })
  return formatAudit(audit, { format: "markdown" })
}

/** One line for a failed audit, the same in both faces. */
function failureText(error: unknown): string {
  return `Test audit failed: ${error instanceof Error ? error.message : String(error)}`
}

/** Read the tool input without trusting its shape. */
function auditArgs(input: unknown): AuditArgs {
  const record = input !== null && typeof input === "object" ? (input as Record<string, unknown>) : {}
  const files = Array.isArray(record.files) ? record.files.filter((file): file is string => typeof file === "string") : undefined
  return {
    base: typeof record.base === "string" ? record.base : undefined,
    head: typeof record.head === "string" ? record.head : undefined,
    staged: record.staged === true,
    files,
  }
}

export default Plugin.define({
  id: "test-audit",
  async setup(ctx) {
    await ctx.command.transform((editor) => {
      editor.add({
        name: "test-audit",
        description: "Audit the tests the working-tree change adds and report a per-test verdict.",
        execute: async ({ sessionID, delivery }) => {
          let text: string
          try {
            text = await report(ctx.location.directory, {})
          } catch (error) {
            text = failureText(error)
          }
          await ctx.session.prompt({ sessionID, text, delivery })
        },
      })
    })

    await ctx.tool.transform((editor) => {
      editor.add({
        name: "test-audit",
        description:
          "Audit the tests a change adds. Classifies each added test against reviewer best practices and reports a verdict. It judges test quality, not coverage.",
        input: {
          type: "object",
          properties: {
            base: { type: "string", description: "Diff against the merge base of this ref and HEAD. Default: the remote default branch." },
            head: { type: "string", description: "Audit base...head instead of the working tree." },
            staged: { type: "boolean", description: "Audit the staged change." },
            files: { type: "array", items: { type: "string" }, description: "Audit these files instead of a range." },
          },
          additionalProperties: false,
        },
        options: { codemode: false },
        execute: async (input) => {
          try {
            return { content: await report(ctx.location.directory, auditArgs(input)) }
          } catch (error) {
            return { content: failureText(error) }
          }
        },
      })
    })
  },
})