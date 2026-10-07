// An OpenCode 2 plugin that gives the agent a persistent per-session task list. It injects the list
// once after a compaction, and nudges the model when a stop leaves tasks open. See README.md.
import { Plugin } from "@opencode/plugin"
import type { Context } from "@opencode/plugin/promise/plugin"
import { Tasklist } from "./rpc"
import {
  createTask,
  deleteTask,
  formatTask,
  formatTasks,
  isOpen,
  readTasks,
  updateTask,
  type Status,
  type Update,
} from "./tasks"

const MAX_NUDGES = 2
const INJECTION_HEADER = "Current task list:"
// session.idle is the older, deprecated signal; a server that still emits it keeps working.
const STOP_EVENTS = new Set(["session.execution.succeeded", "session.idle"])

interface State {
  afterCompaction: Set<string>
  idleBusy: Set<string>
  idleNudges: Map<string, number>
  idleSnapshots: Map<string, string>
}

export default Plugin.define({
  id: "tasklist",
  async setup(ctx) {
    const state = emptyState()

    // The TUI reads the list through this method, so the sidebar works against a remote server.
    const rpc = await ctx.rpc.register(Tasklist, {
      list: async (input) => ({ tasks: readTasks((input as { sessionID: string }).sessionID) }),
    })

    await ctx.tool.transform((editor) => {
      editor.add({
        name: "TaskCreate",
        description: "Create a task in this session's task list. Returns the task id.",
        input: {
          type: "object",
          properties: {
            subject: { type: "string", description: "A brief title for the task." },
            activeForm: { type: "string", description: "Present-continuous form shown while the task runs." },
          },
          required: ["subject"],
          additionalProperties: false,
        },
        options: { codemode: false },
        execute: async (input, context) => {
          const subject = field(input, "subject")?.trim()
          if (!subject) return { content: "TaskCreate needs a non-empty subject." }
          const task = createTask(context.sessionID, subject, field(input, "activeForm"))
          await rpc.events.emit("updated", { sessionID: context.sessionID })
          return { content: `Task #${task.id} created.` }
        },
      })

      editor.add({
        name: "TaskList",
        description: "List every task in this session's task list.",
        input: { type: "object", properties: {}, additionalProperties: false },
        options: { codemode: false },
        execute: async (_input, context) => {
          const tasks = readTasks(context.sessionID)
          return { content: tasks.length === 0 ? "No tasks." : formatTasks(tasks) }
        },
      })

      editor.add({
        name: "TaskUpdate",
        description: 'Update a task by id. Set status to "deleted" to remove it.',
        input: {
          type: "object",
          properties: {
            taskId: { type: "string" },
            status: { type: "string", enum: ["pending", "in_progress", "completed", "deleted"] },
            subject: { type: "string" },
            activeForm: { type: "string" },
          },
          required: ["taskId"],
          additionalProperties: false,
        },
        options: { codemode: false },
        execute: async (input, context) => {
          const taskId = field(input, "taskId")
          if (!taskId) return { content: "TaskUpdate needs a taskId." }
          const status = field(input, "status")
          if (status === "deleted") {
            if (!deleteTask(context.sessionID, taskId)) return { content: notFound(taskId) }
            await rpc.events.emit("updated", { sessionID: context.sessionID })
            return { content: `Task #${taskId} deleted.` }
          }
          const update: Update = {
            status: statusOf(status),
            subject: field(input, "subject"),
            activeForm: field(input, "activeForm"),
          }
          const task = updateTask(context.sessionID, taskId, update)
          if (!task) return { content: notFound(taskId) }
          await rpc.events.emit("updated", { sessionID: context.sessionID })
          return { content: `Task #${taskId} updated.` }
        },
      })

      editor.add({
        name: "TaskGet",
        description: "Get one task's details by id.",
        input: {
          type: "object",
          properties: { taskId: { type: "string" } },
          required: ["taskId"],
          additionalProperties: false,
        },
        options: { codemode: false },
        execute: async (input, context) => {
          const taskId = field(input, "taskId")
          if (!taskId) return { content: "TaskGet needs a taskId." }
          const task = readTasks(context.sessionID).find((candidate) => candidate.id === taskId)
          return { content: task ? formatTask(task) : notFound(taskId) }
        },
      })
    })

    // One-shot: mark the session during its compaction, then inject on the next model call.
    await ctx.session.hook("compaction", (event) => {
      state.afterCompaction.add(event.sessionID)
    })

    await ctx.session.hook("context", (event) => {
      if (!state.afterCompaction.delete(event.sessionID)) return
      const tasks = readTasks(event.sessionID)
      if (tasks.length === 0) return
      event.system.push({ type: "text", text: `${INJECTION_HEADER}\n${formatTasks(tasks)}` })
    })

    const controller = new AbortController()
    void runNudger(ctx, state, controller.signal)
    return () => controller.abort()
  },
})

function emptyState(): State {
  return {
    afterCompaction: new Set(),
    idleBusy: new Set(),
    idleNudges: new Map(),
    idleSnapshots: new Map(),
  }
}

function field(input: unknown, name: string): string | undefined {
  const record = input !== null && typeof input === "object" ? (input as Record<string, unknown>) : undefined
  return typeof record?.[name] === "string" ? (record[name] as string) : undefined
}

function statusOf(value: string | undefined): Status | undefined {
  return value === "pending" || value === "in_progress" || value === "completed" || value === "deleted"
    ? value
    : undefined
}

function notFound(taskId: string): string {
  return `No task #${taskId}.`
}

// Send one user turn on each session stop that leaves tasks open, up to MAX_NUDGES.
// A run that succeeds ends with session.execution.succeeded; OpenCode 2.0.24 emits no
// session.idle, and an interrupted or failed run emits neither, so a stop a person or a
// supervisor made is never nudged back to life.
async function runNudger(ctx: Context, state: State, signal: AbortSignal): Promise<void> {
  try {
    for await (const event of ctx.event.subscribe({ signal })) {
      if (STOP_EVENTS.has(event.type)) await nudge(ctx, state, event.data.sessionID)
    }
  } catch {
    // The stream ends when the plugin unloads (abort). Nothing to recover.
  }
}

async function nudge(ctx: Context, state: State, sessionID: string): Promise<void> {
  if (state.idleBusy.has(sessionID)) return
  state.idleBusy.add(sessionID)
  try {
    const open = readTasks(sessionID).filter(isOpen)
    if (open.length === 0) {
      state.idleNudges.delete(sessionID)
      state.idleSnapshots.delete(sessionID)
      return
    }
    const snapshot = open.map((task) => `${task.id}:${task.status}:${task.subject}`).join("\n")
    if (state.idleSnapshots.get(sessionID) !== snapshot) state.idleNudges.set(sessionID, 0) // Progress resets the cap.
    state.idleSnapshots.set(sessionID, snapshot)
    const sent = state.idleNudges.get(sessionID) ?? 0
    if (sent >= MAX_NUDGES) return
    state.idleNudges.set(sessionID, sent + 1)
    const text = `You have ${open.length} tasks left. Here is the current state:\n${formatTasks(open)}`
    try {
      await ctx.session.prompt({ sessionID, text })
    } catch {
      // The session may vanish between the idle event and the prompt. Fail open.
    }
  } finally {
    state.idleBusy.delete(sessionID)
  }
}
