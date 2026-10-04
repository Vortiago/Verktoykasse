// One JSON file per session holds the task list, at ~/.opencode/tasklist/<sessionID>.json. Every
// operation reads the file, changes it, and writes it back, so the file is the single source of truth.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export type Status = "pending" | "in_progress" | "completed" | "deleted"
export type StoredStatus = Exclude<Status, "deleted">

export interface Task {
  id: string
  subject: string
  status: StoredStatus
  activeForm?: string
}

export interface Update {
  status?: Status
  subject?: string
  activeForm?: string
}

const TASK_DIR = join(homedir(), ".opencode", "tasklist")

export function readTasks(sessionID: string): Task[] {
  try {
    const value: unknown = JSON.parse(readFileSync(pathFor(sessionID), "utf8"))
    return Array.isArray(value) ? value.filter(isTask) : []
  } catch {
    return [] // No file yet, or unreadable JSON. An empty list never wedges the model.
  }
}

function writeTasks(sessionID: string, tasks: readonly Task[]): void {
  mkdirSync(TASK_DIR, { recursive: true })
  writeFileSync(pathFor(sessionID), `${JSON.stringify(tasks, null, 2)}\n`)
}

export function createTask(sessionID: string, subject: string, activeForm?: string): Task {
  const tasks = readTasks(sessionID)
  const task: Task = { id: nextID(tasks), subject, status: "pending" }
  if (activeForm) task.activeForm = activeForm
  tasks.push(task)
  writeTasks(sessionID, tasks)
  return task
}

export function updateTask(sessionID: string, id: string, update: Update): Task | undefined {
  const tasks = readTasks(sessionID)
  const task = tasks.find((candidate) => candidate.id === id)
  if (!task) return undefined
  if (isStoredStatus(update.status)) task.status = update.status
  if (typeof update.subject === "string" && update.subject.trim() !== "") task.subject = update.subject.trim()
  if (typeof update.activeForm === "string" && update.activeForm.trim() !== "") {
    task.activeForm = update.activeForm.trim()
  }
  writeTasks(sessionID, tasks)
  return task
}

export function deleteTask(sessionID: string, id: string): boolean {
  const tasks = readTasks(sessionID)
  const remaining = tasks.filter((task) => task.id !== id)
  if (remaining.length === tasks.length) return false
  writeTasks(sessionID, remaining)
  return true
}

export function isOpen(task: Task): boolean {
  return task.status === "pending" || task.status === "in_progress"
}

/** One line per task, for the tool output and for the injected list. */
export function formatTasks(tasks: readonly Task[]): string {
  return tasks.map((task) => `#${task.id} [${task.status}] ${task.subject}`).join("\n")
}

/** The details of one task, for TaskGet. */
export function formatTask(task: Task): string {
  const lines = [`#${task.id} [${task.status}] ${task.subject}`]
  if (task.activeForm) lines.push(`activeForm: ${task.activeForm}`)
  return lines.join("\n")
}

function nextID(tasks: readonly Task[]): string {
  const highest = tasks.reduce((max, task) => Math.max(max, Number.parseInt(task.id, 10) || 0), 0)
  return String(highest + 1)
}

function pathFor(sessionID: string): string {
  return join(TASK_DIR, `${sessionID.replace(/[^\w.-]/g, "_")}.json`)
}

function isTask(value: unknown): value is Task {
  const record = asRecord(value)
  return (
    typeof record?.id === "string" &&
    typeof record.subject === "string" &&
    isStoredStatus(record.status) &&
    (record.activeForm === undefined || typeof record.activeForm === "string")
  )
}

function isStoredStatus(value: unknown): value is StoredStatus {
  return value === "pending" || value === "in_progress" || value === "completed"
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}
