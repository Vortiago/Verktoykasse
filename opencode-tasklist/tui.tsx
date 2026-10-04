// The sidebar half of the package. One component in the `sidebar.content` slot shows the session's
// task list. It reads the list from the server over RPC, so the sidebar works against a remote server.
import { Plugin, usePlugin } from "@opencode/plugin/tui"
import { ErrorBoundary, For, Show, createSignal, onCleanup, onMount } from "solid-js"
import { Tasklist, type WireTask } from "./rpc"

// One constant holds the state marks. The classic glyphs (☐ ◐ ☑) are the safe fallback; a colour
// emoji may panic a renderer.
const MARK: Record<string, string> = {
  pending: "⬜",
  in_progress: "🔄",
  completed: "✅",
}

function Tasks(props: { readonly sessionID: string }) {
  const context = usePlugin()
  const rpc = context.client.rpc(Tasklist)
  const [tasks, setTasks] = createSignal<WireTask[]>([])

  const refresh = async () => {
    try {
      const result = (await rpc.list({ sessionID: props.sessionID })) as { tasks?: WireTask[] }
      setTasks(result.tasks ?? [])
    } catch {
      // The server half may be absent, or the server may be down. Keep the last list.
    }
  }

  let stop: (() => void) | undefined
  // Read on connect, then follow the server's `updated` event. A reconnect replaces the listener.
  const watch = () => {
    stop?.()
    void refresh()
    stop = rpc.events.on("updated", (event) => {
      if (event.data.sessionID === props.sessionID) void refresh()
    })
  }

  onMount(() => {
    watch()
    const off = context.data.on("server.connected", watch)
    onCleanup(() => {
      off()
      stop?.()
    })
  })

  const color = (task: WireTask) => (task.status === "completed" ? context.theme.text.muted : context.theme.text.base)

  return (
    <box flexDirection="column">
      <text fg={context.theme.text.muted}>Tasks</text>
      <ErrorBoundary fallback={() => <text fg={context.theme.text.muted}>Task list failed to render.</text>}>
        <Show when={tasks().length > 0} fallback={<text fg={context.theme.text.muted}>No tasks</text>}>
          <For each={tasks()}>
            {(task) => (
              <text fg={color(task)} wrapMode="none">
                {MARK[task.status] ?? "·"} {task.subject}
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
