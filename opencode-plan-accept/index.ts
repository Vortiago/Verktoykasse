import { Plugin } from "@opencode/plugin"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join, sep } from "node:path"

const PLAN_DIR = join(homedir(), ".opencode", "plan")

// The tools that create or rewrite a plan file. A read of a plan is not a write.
const PLAN_WRITE_TOOLS = new Set(["write", "edit"])

const planKey = (sessionID: string) => `plan:${sessionID}`

interface PlanReader {
  get(key: string): Promise<unknown>
}

function asPlanPath(value: unknown): string | undefined {
  if (typeof value !== "string") return
  const path = value.startsWith("~") ? join(homedir(), value.slice(1)) : value
  return path.endsWith(".md") && path.startsWith(PLAN_DIR + sep) ? path : undefined
}

function planPathIn(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) return
  for (const value of Object.values(input as Record<string, unknown>)) {
    const path = asPlanPath(value)
    if (path) return path
  }
  return
}

function readPlanFile(path: string): { path: string; text: string } | undefined {
  if (!existsSync(path)) return
  try {
    return { path, text: readFileSync(path, "utf8") }
  } catch {
    return
  }
}

function newestPlan(): { path: string; text: string } | undefined {
  let newest: { path: string; mtime: number } | undefined
  try {
    for (const name of readdirSync(PLAN_DIR)) {
      if (!name.endsWith(".md")) continue
      const path = join(PLAN_DIR, name)
      const mtime = statSync(path).mtimeMs
      if (!newest || mtime > newest.mtime) newest = { path, mtime }
    }
  } catch {
    return
  }
  return newest ? readPlanFile(newest.path) : undefined
}

// The plan this session wrote, so /accept never grabs another session's plan.
// Falls back to the newest plan for a session that predates the write hook.
async function sessionPlan(storage: PlanReader, sessionID: string) {
  const recorded = await storage.get(planKey(sessionID))
  if (typeof recorded === "string") {
    const plan = readPlanFile(recorded)
    if (plan) return plan
  }
  return newestPlan()
}

export default Plugin.define({
  id: "plan-accept",
  async setup(ctx) {
    // Remember the plan each session writes, keyed by that session.
    await ctx.tool.hook("execute.before", ({ tool, sessionID, input }) => {
      if (!PLAN_WRITE_TOOLS.has(tool)) return
      const path = planPathIn(input)
      if (path) return ctx.storage.set(planKey(sessionID), path)
    })

    await ctx.command.transform((editor) => {
      editor.add({
        name: "accept",
        description: "Accept the plan: compact the session, switch to the build agent, and build.",
        execute: async ({ sessionID, delivery }) => {
          const build = await ctx.agent.get({ agentID: "build" })
          const plan = await sessionPlan(ctx.storage, sessionID)
          await ctx.session.compact({ sessionID })
          // Switching agent alone keeps the plan model, so the build model must
          // be set too. agent.get wraps AgentInfo in `data`.
          await ctx.session.switchAgent({ sessionID, agent: "build" })
          let model = build.data.model
          if (!model) {
            const fallback = (await ctx.model.default()).data
            if (fallback) model = { id: fallback.id, providerID: fallback.providerID }
          }
          if (model) await ctx.session.switchModel({ sessionID, model })
          await ctx.session.prompt({
            sessionID,
            text: plan ? `Implement the plan in ${plan.path}:\n\n${plan.text}` : "Implement the plan.",
            delivery,
          })
        },
      })
    })
  },
})
