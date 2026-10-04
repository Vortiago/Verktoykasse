// The sidebar half of the package. One component in the `sidebar.content` slot shows the session's
// task list. It polls the same JSON file the server tools write, so view and tools never disagree.
import { Plugin, usePlugin } from "@opencode/plugin/tui"
import { ErrorBoundary, For, Show, createSignal, onCleanup } from "solid-js"
import { readTasks, type StoredStatus, type Task } from "./tasks"

const REFRESH_MS = 1000

// One constant holds the state marks. The classic glyphs (☐ ◐ ☑) are the safe fallback; a colour
// emoji may panic a renderer.
const MARK: Record<StoredStatus, string> = {
  pending: "⬜",
  in_progress: "🔄",
  completed: "✅",
}

function Tasks(props: { readonly sessionID: string }) {
  const context = usePlugin()
  const [tasks, setTasks] = createSignal<Task[]>(readTasks(props.sessionID))
  const timer = setInterval(() => setTasks(readTasks(props.sessionID)), REFRESH_MS)
  onCleanup(() => clearInterval(timer))

  const color = (task: Task) => (task.status === "completed" ? context.theme.text.muted : context.theme.text.base)

  return (
    <box flexDirection="column">
      <text fg={context.theme.text.muted}>Tasks</text>
      <ErrorBoundary fallback={() => <text fg={context.theme.text.muted}>Task list failed to render.</text>}>
        <Show when={tasks().length > 0} fallback={<text fg={context.theme.text.muted}>No tasks</text>}>
          <For each={tasks()}>
            {(task) => (
              <text fg={color(task)} wrapMode="none">
                {MARK[task.status]} {task.subject}
              </text>
            )}
          </For>
        </Show>
      </ErrorBoundary>
    </box>
  )
}

export default Plugin.define({
  id: "tasklist.tui",
  setup(context) {
    return context.ui.slot({
      append: "sidebar.content",
      render: ({ sessionID }) => <Tasks sessionID={sessionID} />,
    })
  },
})
