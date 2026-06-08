import { describe, expect, test } from "bun:test"
import { createStore } from "solid-js/store"
import { QueryClient } from "@tanstack/solid-query"
import type { Config, OpencodeClient, Project } from "@opencode-ai/sdk/v2/client"
import type { NormalizedProviderListResponse } from "@opencode-ai/ui/context"
import { bootstrapDirectory } from "./bootstrap"
import type { State, VcsCache } from "./types"

const provider = { all: new Map(), connected: [], default: {} } satisfies NormalizedProviderListResponse

function createTestState(path = { state: "", config: "", worktree: "/project", directory: "/project", home: "/home" }) {
  return createStore<State>({
    status: "loading",
    agent: [],
    command: [],
    project: "",
    projectMeta: undefined,
    icon: undefined,
    provider_ready: true,
    provider,
    config: {},
    path,
    session: [],
    sessionTotal: 0,
    session_status: {},
    session_working(id: string) {
      return this.session_status[id]?.type !== "idle"
    },
    session_diff: {},
    todo: {},
    permission: {},
    question: {},
    mcp_ready: true,
    mcp: {},
    lsp_ready: true,
    lsp: [],
    vcs: undefined,
    limit: 5,
    message: {},
    part: {},
    part_text_accum_delta: {},
  })
}

describe("bootstrapDirectory", () => {
  test("marks a loading directory partial during bootstrap and complete after success", async () => {
    const mcpReads: string[] = []
    const [store, setStore] = createTestState()

    await bootstrapDirectory({
      directory: "/project",
      mcp: false,
      global: {
        config: {} satisfies Config,
        path: { state: "", config: "", worktree: "/project", directory: "/project", home: "/home" },
        project: [{ id: "project", worktree: "/project" } as Project],
        provider,
      },
      sdk: {
        app: { agents: async () => ({ data: [{ name: "build", mode: "primary" }] }) },
        config: { get: async () => ({ data: {} }) },
        session: { status: async () => ({ data: {} }) },
        vcs: { get: async () => ({ data: undefined }) },
        command: {
          list: async () => {
            mcpReads.push("command")
            return { data: [] }
          },
        },
        permission: { list: async () => ({ data: [] }) },
        question: { list: async () => ({ data: [] }) },
        mcp: {
          status: async () => {
            mcpReads.push("status")
            return { data: {} }
          },
        },
        provider: { list: async () => ({ data: { all: [], connected: [], default: {} } }) },
      } as unknown as OpencodeClient,
      store,
      setStore,
      vcsCache: { setStore() {} } as unknown as VcsCache,
      loadSessions() {},
      translate: (key) => key,
      queryClient: new QueryClient(),
    })

    expect(store.status).toBe("partial")

    await new Promise((resolve) => setTimeout(resolve, 80))

    expect(store.status).toBe("complete")
    expect(mcpReads).toEqual([])
  })

  test("keeps the seeded project when Windows path separators differ", async () => {
    const currentProjectReads: string[] = []
    const [store, setStore] = createTestState({
      state: "",
      config: "",
      worktree: "D:/SynologyDrive/ZhuSync/workcopy/test-model-harness",
      directory: "D:/SynologyDrive/ZhuSync/workcopy/test-model-harness",
      home: "D:/Users/admin",
    })

    await bootstrapDirectory({
      directory: "D:\\SynologyDrive\\ZhuSync\\workcopy\\test-model-harness",
      mcp: false,
      global: {
        config: {} satisfies Config,
        path: {
          state: "",
          config: "",
          worktree: "D:/workcopy/DoMedia",
          directory: "D:/workcopy/DoMedia",
          home: "",
        },
        project: [
          { id: "domedia", worktree: "D:/workcopy/DoMedia" } as Project,
          { id: "test", worktree: "D:/SynologyDrive/ZhuSync/workcopy/test-model-harness" } as Project,
        ],
        provider,
      },
      sdk: {
        app: { agents: async () => ({ data: [] }) },
        config: { get: async () => ({ data: {} }) },
        project: {
          current: async () => {
            currentProjectReads.push("current")
            return { data: { id: "domedia", worktree: "D:/workcopy/DoMedia" } }
          },
        },
        path: {
          get: async () => ({
            data: {
              state: "",
              config: "",
              worktree: "D:/workcopy/DoMedia",
              directory: "D:/workcopy/DoMedia",
              home: "",
            },
          }),
        },
        session: { status: async () => ({ data: {} }) },
        vcs: { get: async () => ({ data: undefined }) },
        command: { list: async () => ({ data: [] }) },
        permission: { list: async () => ({ data: [] }) },
        question: { list: async () => ({ data: [] }) },
        mcp: { status: async () => ({ data: {} }) },
        provider: { list: async () => ({ data: { all: [], connected: [], default: {} } }) },
      } as unknown as OpencodeClient,
      store,
      setStore,
      vcsCache: { setStore() {} } as unknown as VcsCache,
      loadSessions() {},
      translate: (key) => key,
      queryClient: new QueryClient(),
    })

    expect(store.project).toBe("test")

    await new Promise((resolve) => setTimeout(resolve, 80))

    expect(store.project).toBe("test")
    expect(currentProjectReads).toEqual([])
  })
})
