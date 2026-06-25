import type { GlobalSession, Project } from "@opencode-ai/sdk/v2/client"
import { getFilename } from "@opencode-ai/core/util/path"
import { Button } from "@opencode-ai/ui/button"
import { Checkbox } from "@opencode-ai/ui/checkbox"
import { Icon } from "@opencode-ai/ui/icon"
import { showToast } from "@opencode-ai/ui/toast"
import { DateTime } from "luxon"
import { createEffect, createMemo, createResource, createSignal, For, Show, type Component, type JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useServer } from "@/context/server"
import { useServerSDK } from "@/context/server-sdk"
import { useServerSync } from "@/context/server-sync"
import { formatServerError } from "@/utils/server-errors"
import { pathKey } from "@/utils/path-key"
import { sessionTitle } from "@/utils/session-title"
import { SettingsList } from "./settings-list"

type ConfirmDelete =
  | { type: "project"; id: string }
  | { type: "session"; id: string }
  | { type: "projects" }
  | { type: "sessions" }

type ProjectDeleteResult = { ok: true; project: Project } | { ok: false; project: Project; error: unknown }
type SessionDeleteResult = { ok: true; session: GlobalSession } | { ok: false; session: GlobalSession; error: unknown }

export const SettingsArchived: Component = () => {
  const language = useLanguage()
  const layout = useLayout()
  const server = useServer()
  const serverSDK = useServerSDK()
  const serverSync = useServerSync()
  const [busy, setBusy] = createSignal<string>()
  const [confirming, setConfirming] = createSignal<ConfirmDelete>()
  const [selectedProjectIDs, setSelectedProjectIDs] = createSignal<ReadonlySet<string>>(new Set())
  const [selectedSessionIDs, setSelectedSessionIDs] = createSignal<ReadonlySet<string>>(new Set())

  const openProjects = createMemo(() => layout.projects.list())
  const openProjectKeys = createMemo(() => new Set(openProjects().map((project) => pathKey(project.worktree))))
  const openProjectIDs = createMemo(
    () => new Set(openProjects().flatMap((project) => (project.id ? [project.id] : []))),
  )
  const closedProjects = createMemo(() => {
    if (!layout.ready()) return []
    return serverSync().data.project
      .filter((project) => project.id !== "global")
      .filter((project) => !openProjectKeys().has(pathKey(project.worktree)))
      .filter((project) => !openProjectIDs().has(project.id))
      .slice()
      .sort((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
  })

  const archivedSessionSource = createMemo(() =>
    serverSync().data.project.map((project) => `${project.id}:${project.time.updated}`).join("|"),
  )
  const [archivedSessions, { refetch: refetchArchivedSessions }] = createResource(
    archivedSessionSource,
    async () =>
      serverSDK().client.experimental.session
        .list({ archived: true, roots: true, limit: 500 })
        .then((res) => res.data?.filter((session) => session.time.archived !== undefined) ?? [])
        .catch((err: unknown) => {
          showToast({
            variant: "error",
            title: language.t("common.requestFailed"),
            description: formatServerError(err, language.t),
          })
          return [] as GlobalSession[]
        }),
    { initialValue: [] as GlobalSession[] },
  )

  const selectedProjects = createMemo(() => closedProjects().filter((project) => selectedProjectIDs().has(project.id)))
  const selectedSessions = createMemo(() =>
    archivedSessions().filter((session) => selectedSessionIDs().has(session.id)),
  )
  const projectSelection = createMemo(() => selectionState(closedProjects().length, selectedProjects().length))
  const sessionSelection = createMemo(() => selectionState(archivedSessions().length, selectedSessions().length))

  createEffect(() => {
    const keep = new Set(closedProjects().map((project) => project.id))
    setSelectedProjectIDs((current) => filterSelected(current, keep))
  })

  createEffect(() => {
    const keep = new Set(archivedSessions().map((session) => session.id))
    setSelectedSessionIDs((current) => filterSelected(current, keep))
  })

  const time = (value: number | undefined) => {
    if (!value) return ""
    return DateTime.fromMillis(value).setLocale(language.intl()).toRelative() ?? ""
  }

  const projectName = (project: Project) => project.name ?? getFilename(project.worktree)
  const projectAction = (project: Project, action: string) => `project:${action}:${project.id}`
  const sessionAction = (session: GlobalSession, action: string) => `session:${action}:${session.id}`
  const sessionName = (session: GlobalSession) => sessionTitle(session.title) || session.id

  const setAllProjects = (checked: boolean) => {
    setSelectedProjectIDs(checked ? new Set(closedProjects().map((project) => project.id)) : new Set<string>())
  }

  const setAllSessions = (checked: boolean) => {
    setSelectedSessionIDs(checked ? new Set(archivedSessions().map((session) => session.id)) : new Set<string>())
  }

  const toggleProject = (projectID: string, checked: boolean) => {
    setSelectedProjectIDs((current) => toggleSelected(current, projectID, checked))
  }

  const toggleSession = (sessionID: string, checked: boolean) => {
    setSelectedSessionIDs((current) => toggleSelected(current, sessionID, checked))
  }

  const restoreProject = (project: Project) => {
    setBusy(projectAction(project, "restore"))
    layout.projects.open(project.worktree)
    server.projects.touch(project.worktree)
    setBusy(undefined)
    showToast({
      variant: "success",
      icon: "circle-check",
      title: language.t("settings.archived.project.restore.success", { name: projectName(project) }),
    })
  }

  const deleteProjects = async (projects: Project[]) => {
    if (projects.length === 0) return
    setBusy(projects.length === 1 ? projectAction(projects[0], "delete") : "project:delete:selected")

    const results = await Promise.all(
      projects.map((project) =>
        serverSDK().client.project
          .delete({ projectID: project.id, directory: project.worktree })
          .then(() => ({ ok: true, project }) as ProjectDeleteResult)
          .catch((error: unknown) => ({ ok: false, project, error }) as ProjectDeleteResult),
      ),
    )
    const deleted = results.filter((result): result is Extract<ProjectDeleteResult, { ok: true }> => result.ok)
    const failed = results.filter((result): result is Extract<ProjectDeleteResult, { ok: false }> => !result.ok)

    if (deleted.length > 0) {
      const ids = new Set(deleted.map((result) => result.project.id))
      deleted.forEach((result) => layout.projects.close(result.project.worktree))
      serverSync().set("project", (items) => items.filter((item) => !ids.has(item.id)))
      setSelectedProjectIDs((current) => removeSelected(current, ids))
      void refetchArchivedSessions()
      showToast({
        variant: "success",
        icon: "circle-check",
        title:
          deleted.length === 1
            ? language.t("settings.archived.project.delete.success", { name: projectName(deleted[0].project) })
            : language.t("settings.archived.project.delete.selected.success", { count: deleted.length }),
      })
    }

    if (failed.length > 0) {
      showToast({
        variant: "error",
        title:
          failed.length === 1
            ? language.t("settings.archived.project.delete.failed")
            : language.t("settings.archived.project.delete.selected.failed", { count: failed.length }),
        description: formatServerError(failed[0].error, language.t),
      })
    }

    setConfirming(undefined)
    setBusy(undefined)
  }

  const restoreSession = async (session: GlobalSession) => {
    setBusy(sessionAction(session, "restore"))
    await serverSDK().client.session
      .update({ sessionID: session.id, directory: session.directory, time: { archived: null } })
      .then(() => {
        void refetchArchivedSessions()
        void serverSync().project.loadSessions(session.directory)
        showToast({
          variant: "success",
          icon: "circle-check",
          title: language.t("settings.archived.session.restore.success", { title: sessionName(session) }),
        })
      })
      .catch((err: unknown) => {
        showToast({
          variant: "error",
          title: language.t("settings.archived.session.restore.failed"),
          description: formatServerError(err, language.t),
        })
      })
      .finally(() => setBusy(undefined))
  }

  const deleteSessions = async (sessions: GlobalSession[]) => {
    if (sessions.length === 0) return
    setBusy(sessions.length === 1 ? sessionAction(sessions[0], "delete") : "session:delete:selected")

    const results = await Promise.all(
      sessions.map((session) =>
        serverSDK().client.session
          .delete({ sessionID: session.id, directory: session.directory })
          .then(() => ({ ok: true, session }) as SessionDeleteResult)
          .catch((error: unknown) => ({ ok: false, session, error }) as SessionDeleteResult),
      ),
    )
    const deleted = results.filter((result): result is Extract<SessionDeleteResult, { ok: true }> => result.ok)
    const failed = results.filter((result): result is Extract<SessionDeleteResult, { ok: false }> => !result.ok)

    if (deleted.length > 0) {
      const ids = new Set(deleted.map((result) => result.session.id))
      setSelectedSessionIDs((current) => removeSelected(current, ids))
      void refetchArchivedSessions()
      void Promise.all(
        Array.from(new Set(deleted.map((result) => result.session.directory))).map((directory) =>
          serverSync().project.loadSessions(directory),
        ),
      )
      showToast({
        variant: "success",
        icon: "circle-check",
        title:
          deleted.length === 1
            ? language.t("settings.archived.session.delete.success", { title: sessionName(deleted[0].session) })
            : language.t("settings.archived.session.delete.selected.success", { count: ids.size }),
      })
    }

    if (failed.length > 0) {
      showToast({
        variant: "error",
        title:
          failed.length === 1
            ? language.t("settings.archived.session.delete.failed")
            : language.t("settings.archived.session.delete.selected.failed", { count: failed.length }),
        description: formatServerError(failed[0].error, language.t),
      })
    }

    setConfirming(undefined)
    setBusy(undefined)
  }

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar px-4 pb-10 sm:px-10 sm:pb-10">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-col gap-1 pt-6 pb-8 max-w-[720px]">
          <h2 class="text-16-medium text-text-strong">{language.t("settings.archived.title")}</h2>
        </div>
      </div>

      <div class="flex flex-col gap-8 max-w-[720px]">
        <ArchivedSection
          title={language.t("settings.archived.projects.title")}
          actions={
            <SelectionControls
              total={projectSelection().total}
              selected={projectSelection().selected}
              all={projectSelection().all}
              partial={projectSelection().partial}
              confirming={confirming()?.type === "projects"}
              disabled={!!busy()}
              onSelectAll={setAllProjects}
              onDelete={() => setConfirming({ type: "projects" })}
              onConfirm={() => void deleteProjects(selectedProjects())}
              onCancel={() => setConfirming(undefined)}
            />
          }
        >
          <Show
            when={closedProjects().length > 0}
            fallback={<ArchivedEmpty>{language.t("settings.archived.projects.empty")}</ArchivedEmpty>}
          >
            <For each={closedProjects()}>
              {(project) => {
                const confirm = () => {
                  const current = confirming()
                  return current?.type === "project" && current.id === project.id
                }
                return (
                  <ArchivedRow
                    icon="folder"
                    title={projectName(project)}
                    subtitle={project.worktree}
                    meta={time(project.time.updated ?? project.time.created)}
                    selected={selectedProjectIDs().has(project.id)}
                    disabled={!!busy()}
                    onSelectedChange={(checked) => toggleProject(project.id, checked)}
                    actions={
                      <Show
                        when={confirm()}
                        fallback={
                          <>
                            <Button
                              size="small"
                              variant="secondary"
                              icon="reset"
                              disabled={!!busy()}
                              onClick={() => restoreProject(project)}
                            >
                              {language.t("settings.archived.action.restore")}
                            </Button>
                            <Button
                              size="small"
                              variant="ghost"
                              icon="trash"
                              class="text-icon-critical-base"
                              disabled={!!busy()}
                              onClick={() => setConfirming({ type: "project", id: project.id })}
                            >
                              {language.t("settings.archived.action.deleteForever")}
                            </Button>
                          </>
                        }
                      >
                        <Button
                          size="small"
                          variant="ghost"
                          disabled={!!busy()}
                          onClick={() => setConfirming(undefined)}
                        >
                          {language.t("common.cancel")}
                        </Button>
                        <Button
                          size="small"
                          variant="primary"
                          icon="trash"
                          disabled={!!busy()}
                          onClick={() => void deleteProjects([project])}
                        >
                          {language.t("settings.archived.action.confirmDelete")}
                        </Button>
                      </Show>
                    }
                  />
                )
              }}
            </For>
          </Show>
        </ArchivedSection>

        <ArchivedSection
          title={language.t("settings.archived.sessions.title")}
          actions={
            <SelectionControls
              total={sessionSelection().total}
              selected={sessionSelection().selected}
              all={sessionSelection().all}
              partial={sessionSelection().partial}
              confirming={confirming()?.type === "sessions"}
              disabled={!!busy() || archivedSessions.loading}
              onSelectAll={setAllSessions}
              onDelete={() => setConfirming({ type: "sessions" })}
              onConfirm={() => void deleteSessions(selectedSessions())}
              onCancel={() => setConfirming(undefined)}
            />
          }
        >
          <Show
            when={!archivedSessions.loading}
            fallback={<ArchivedEmpty>{language.t("common.loading")}</ArchivedEmpty>}
          >
            <Show
              when={archivedSessions().length > 0}
              fallback={<ArchivedEmpty>{language.t("settings.archived.sessions.empty")}</ArchivedEmpty>}
            >
              <For each={archivedSessions()}>
                {(session) => {
                  const confirm = () => {
                    const current = confirming()
                    return current?.type === "session" && current.id === session.id
                  }
                  return (
                    <ArchivedRow
                      icon="speech-bubble"
                      title={sessionName(session)}
                      subtitle={session.project?.name ?? getFilename(session.directory)}
                      meta={time(session.time.archived ?? session.time.updated)}
                      selected={selectedSessionIDs().has(session.id)}
                      disabled={!!busy()}
                      onSelectedChange={(checked) => toggleSession(session.id, checked)}
                      actions={
                        <Show
                          when={confirm()}
                          fallback={
                            <>
                              <Button
                                size="small"
                                variant="secondary"
                                icon="reset"
                                disabled={!!busy()}
                                onClick={() => void restoreSession(session)}
                              >
                                {language.t("settings.archived.action.restore")}
                              </Button>
                              <Button
                                size="small"
                                variant="ghost"
                                icon="trash"
                                class="text-icon-critical-base"
                                disabled={!!busy()}
                                onClick={() => setConfirming({ type: "session", id: session.id })}
                              >
                                {language.t("settings.archived.action.deleteForever")}
                              </Button>
                            </>
                          }
                        >
                          <Button
                            size="small"
                            variant="ghost"
                            disabled={!!busy()}
                            onClick={() => setConfirming(undefined)}
                          >
                            {language.t("common.cancel")}
                          </Button>
                          <Button
                            size="small"
                            variant="primary"
                            icon="trash"
                            disabled={!!busy()}
                            onClick={() => void deleteSessions([session])}
                          >
                            {language.t("settings.archived.action.confirmDelete")}
                          </Button>
                        </Show>
                      }
                    />
                  )
                }}
              </For>
            </Show>
          </Show>
        </ArchivedSection>
      </div>
    </div>
  )
}

const ArchivedSection: Component<{ title: string; actions?: JSX.Element; children: JSX.Element }> = (props) => {
  return (
    <div class="flex flex-col gap-1">
      <div class="flex items-center justify-between gap-3 pb-2">
        <h3 class="text-14-medium text-text-strong">{props.title}</h3>
        <Show when={props.actions}>{props.actions}</Show>
      </div>
      <SettingsList>{props.children}</SettingsList>
    </div>
  )
}

const SelectionControls: Component<{
  total: number
  selected: number
  all: boolean
  partial: boolean
  confirming: boolean
  disabled: boolean
  onSelectAll: (checked: boolean) => void
  onDelete: () => void
  onConfirm: () => void
  onCancel: () => void
}> = (props) => {
  const language = useLanguage()
  return (
    <Show when={props.total > 0}>
      <div class="flex items-center gap-3">
        <Checkbox
          checked={props.all}
          indeterminate={props.partial}
          disabled={props.disabled}
          onChange={props.onSelectAll}
        >
          {language.t("settings.archived.action.selectAll")}
        </Checkbox>
        <Show
          when={props.confirming}
          fallback={
            <Button
              size="small"
              variant="ghost"
              icon="trash"
              class="text-icon-critical-base"
              disabled={props.disabled || props.selected === 0}
              onClick={props.onDelete}
            >
              {language.t("settings.archived.action.deleteSelected", { count: props.selected })}
            </Button>
          }
        >
          <Button size="small" variant="ghost" disabled={props.disabled} onClick={props.onCancel}>
            {language.t("common.cancel")}
          </Button>
          <Button
            size="small"
            variant="primary"
            icon="trash"
            disabled={props.disabled || props.selected === 0}
            onClick={props.onConfirm}
          >
            {language.t("settings.archived.action.confirmDelete")}
          </Button>
        </Show>
      </div>
    </Show>
  )
}

const ArchivedEmpty: Component<{ children: JSX.Element }> = (props) => {
  return <div class="py-4 text-14-regular text-text-weak">{props.children}</div>
}

const ArchivedRow: Component<{
  icon: "folder" | "speech-bubble"
  title: string
  subtitle: string
  meta: string
  selected: boolean
  disabled: boolean
  actions: JSX.Element
  onSelectedChange: (checked: boolean) => void
}> = (props) => {
  return (
    <div class="flex flex-wrap items-center justify-between gap-4 min-h-16 py-3 border-b border-border-weak-base last:border-none">
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <Checkbox hideLabel checked={props.selected} disabled={props.disabled} onChange={props.onSelectedChange}>
          {props.title}
        </Checkbox>
        <Icon name={props.icon} class="shrink-0 icon-strong-base" />
        <div class="flex flex-col min-w-0">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-14-medium text-text-strong truncate">{props.title}</span>
            <Show when={props.meta}>
              <span class="text-12-regular text-text-weak shrink-0">{props.meta}</span>
            </Show>
          </div>
          <span class="text-12-regular text-text-weak truncate">{props.subtitle}</span>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">{props.actions}</div>
    </div>
  )
}

function selectionState(total: number, selected: number) {
  return {
    total,
    selected,
    all: total > 0 && selected === total,
    partial: selected > 0 && selected < total,
  }
}

function toggleSelected(current: ReadonlySet<string>, id: string, checked: boolean) {
  const next = new Set(current)
  if (checked) {
    next.add(id)
    return next
  }
  next.delete(id)
  return next
}

function filterSelected(current: ReadonlySet<string>, keep: Set<string>) {
  const next = new Set(Array.from(current).filter((id) => keep.has(id)))
  if (next.size === current.size) return current
  return next
}

function removeSelected(current: ReadonlySet<string>, remove: Set<string>) {
  const next = new Set(Array.from(current).filter((id) => !remove.has(id)))
  if (next.size === current.size) return current
  return next
}
