import { Plugin } from "@opencode/plugin"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const PLAN_DIR = join(homedir(), ".opencode", "plan")

// The plan just accepted is the newest file in the plan directory.
function newestPlan(): { path: string; text: string } | undefined {
  let newest: { path: string; mtime: number } | undefined
  try {
    for (const name of readdirSync(PLAN_DIR)) {
      if (!name.endsWith(".md")) continue
      const path = join(PLAN_DIR, name)
      const mtime = statSync(path).mtimeMs
      if (!newest || mtime > newest.mtime) newest = { path, mtime }
    }
    if (!newest) return undefined
    return { path: newest.path, text: readFileSync(newest.path, "utf8") }
  } catch {
    return undefined
  }
}

export default Plugin.define({
  id: "plan-accept",
  async setup(ctx) {
    await ctx.command.transform((editor) => {
      editor.add({
        name: "accept",
        description: "Accept the plan: compact the session, switch to the build agent, and build.",
        execute: async ({ sessionID, delivery }) => {
          const build = await ctx.agent.get({ agentID: "build" })
          const plan = newestPlan()
          await ctx.session.compact({ sessionID })
          // Switching agent alone keeps the plan model, so the build model must
          // be set too. agent.get wraps AgentInfo in `data`.
          await ctx.session.switchAgent({ sessionID, agent: "build" })
          if (build.data.model) await ctx.session.switchModel({ sessionID, model: build.data.model })
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
