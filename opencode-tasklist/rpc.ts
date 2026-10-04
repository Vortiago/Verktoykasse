import { Rpc } from "@opencode/plugin/rpc"

export interface WireTask {
  id: string
  subject: string
  status: string
  activeForm?: string
}

// The wire contract between the server half and the TUI half. The TUI reads the list through this
// method, so the sidebar works against a remote server, not only a local file.
export const Tasklist = Rpc.define({
  id: "tasklist",
  methods: {
    list: {
      input: {
        type: "object",
        properties: { sessionID: { type: "string" } },
        required: ["sessionID"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                subject: { type: "string" },
                status: { type: "string" },
                activeForm: { type: "string" },
              },
              required: ["id", "subject", "status"],
              additionalProperties: false,
            },
          },
        },
        required: ["tasks"],
        additionalProperties: false,
      },
    },
  },
  events: {
    updated: {
      schema: {
        type: "object",
        properties: { sessionID: { type: "string" } },
        required: ["sessionID"],
        additionalProperties: false,
      },
    },
  },
})
