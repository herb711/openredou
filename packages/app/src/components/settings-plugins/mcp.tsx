import type { Config, McpLocalConfig, McpRemoteConfig, McpStatus } from "@opencode-ai/sdk/v2/client"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Select } from "@opencode-ai/ui/select"
import { Switch } from "@opencode-ai/ui/switch"
import { Tag } from "@opencode-ai/ui/tag"
import { TextField } from "@opencode-ai/ui/text-field"
import { showToast } from "@opencode-ai/ui/toast"
import { useQueryClient } from "@tanstack/solid-query"
import { createMemo, For, Show, type Component } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { useQueryOptions, useServerSync } from "@/context/server-sync"
import { useServerSDK } from "@/context/server-sdk"
import { pathKey } from "@/utils/path-key"
import { SettingsList } from "../settings-list"
import { FormRow, readPairs, writePairs } from "./common"

type McpConfig = NonNullable<Config["mcp"]>[string]
type McpType = "local" | "remote"
type McpProbeResult = {
  status: McpStatus
  tools: Array<{ name: string; description?: string }>
  smoke?: {
    ok: boolean
    tool: string
    error?: string
    outputPreview?: string
  }
}

const MCP_TYPE_OPTIONS: Array<{ value: McpType; label: string }> = [
  { value: "local", label: "Local" },
  { value: "remote", label: "Remote" },
]

const statusLabels = {
  connected: "mcp.status.connected",
  connecting: "mcp.status.connecting",
  failed: "mcp.status.failed",
  needs_auth: "mcp.status.needs_auth",
  needs_client_registration: "mcp.status.needs_client_registration",
  disabled: "mcp.status.disabled",
} as const

export const SettingsMcpPanel: Component<{ directory: string }> = (props) => {
  const language = useLanguage()
  const queryClient = useQueryClient()
  const queryOptions = useQueryOptions()
  const serverSDK = useServerSDK()
  const serverSync = useServerSync()

  const mcpConfig = createMemo(() => serverSync().data.config.mcp ?? {})
  const mcpItems = createMemo(() =>
    Object.entries(mcpConfig())
      .map(([name, config]) => ({ name, config }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  )
  const [state, setState] = createStore({
    savingMcp: false,
    togglingMcp: "",
    importingMcp: false,
  })
  const [importState, setImportState] = createStore({
    text: "",
    error: "",
  })
  const [probeState, setProbeState] = createStore<
    Record<string, { loading: boolean; result?: McpProbeResult; error?: string }>
  >({})
  const [mcpForm, setMcpForm] = createStore({
    editing: "",
    name: "",
    type: "local" as McpType,
    command: "",
    url: "",
    enabled: true,
    timeout: "",
    environment: "",
    headers: "",
    oauth: true,
    minimaxApiKey: "",
  })

  const resetMcpForm = () => {
    setMcpForm({
      editing: "",
      name: "",
      type: "local",
      command: "",
      url: "",
      enabled: true,
      timeout: "",
      environment: "",
      headers: "",
      oauth: true,
      minimaxApiKey: "",
    })
  }

  const mcpStatus = (name: string): McpStatus | undefined => {
    if (!props.directory) return
    return serverSync().peek(props.directory)[0].mcp?.[name]
  }

  const saveMcpPatch = async (patch: Record<string, McpConfig | undefined>, next: NonNullable<Config["mcp"]>) => {
    const before = mcpConfig()
    setState("savingMcp", true)
    serverSync().set("config", "mcp", next)
    await serverSync()
      .updateConfig({ mcp: patch as NonNullable<Config["mcp"]> })
      .then(() => {
        resetMcpForm()
        showToast({ variant: "success", icon: "circle-check", title: language.t("settings.mcp.toast.saved.title") })
        if (props.directory) void queryClient.refetchQueries(queryOptions().mcp(pathKey(props.directory)))
      })
      .catch((err: unknown) => {
        serverSync().set("config", "mcp", before)
        showToast({
          variant: "error",
          title: language.t("settings.mcp.toast.failed.title"),
          description: err instanceof Error ? err.message : String(err),
        })
      })
      .finally(() => setState("savingMcp", false))
  }

  const saveMcp = () => {
    const name = mcpForm.name.trim()
    if (!name) {
      showToast({ title: language.t("settings.mcp.validation.name") })
      return
    }

    const timeout = mcpForm.timeout.trim() ? Number(mcpForm.timeout.trim()) : undefined
    if (timeout !== undefined && (!Number.isFinite(timeout) || timeout < 1)) {
      showToast({ title: language.t("settings.mcp.validation.timeout") })
      return
    }

    const existing = mcpForm.editing ? mcpConfig()[mcpForm.editing] : undefined
    const config = mcpForm.type === "local" ? localMcpConfig(timeout) : remoteMcpConfig(timeout, existing)
    if (!config) return

    const next = { ...mcpConfig() }
    const patch: Record<string, McpConfig | undefined> = {}
    if (mcpForm.editing && mcpForm.editing !== name) {
      delete next[mcpForm.editing]
      patch[mcpForm.editing] = undefined
    }
    next[name] = config
    patch[name] = config
    void saveMcpPatch(patch, next)
  }

  const localMcpConfig = (timeout: number | undefined): McpLocalConfig | undefined => {
    const command = parseCommandLine(mcpForm.command)
    if (command.length === 0) {
      showToast({ title: language.t("settings.mcp.validation.command") })
      return
    }
    const environment = { ...(readPairs(mcpForm.environment) ?? {}) }
    delete environment.MINIMAX_API_KEY
    const minimaxApiKey = mcpForm.minimaxApiKey.trim()
    if (minimaxApiKey) environment.MINIMAX_API_KEY = minimaxApiKey
    return {
      type: "local",
      command,
      enabled: mcpForm.enabled,
      ...(Object.keys(environment).length > 0 ? { environment } : {}),
      ...(timeout ? { timeout } : {}),
    }
  }

  const remoteMcpConfig = (
    timeout: number | undefined,
    existing: McpConfig | undefined,
  ): McpRemoteConfig | undefined => {
    if (!mcpForm.url.trim()) {
      showToast({ title: language.t("settings.mcp.validation.url") })
      return
    }
    const headers = readPairs(mcpForm.headers)
    return {
      type: "remote",
      url: mcpForm.url.trim(),
      enabled: mcpForm.enabled,
      ...(headers ? { headers } : {}),
      ...(mcpForm.oauth
        ? isRemoteMcp(existing) && typeof existing.oauth === "object"
          ? { oauth: existing.oauth }
          : {}
        : { oauth: false }),
      ...(timeout ? { timeout } : {}),
    }
  }

  const setMcpEnabled = (name: string, checked: boolean) => {
    const config = mcpConfig()[name]
    if (!config) return
    void saveMcpPatch(
      { [name]: { ...config, enabled: checked } },
      { ...mcpConfig(), [name]: { ...config, enabled: checked } },
    )
  }

  const removeMcp = (name: string) => {
    const next = { ...mcpConfig() }
    delete next[name]
    void saveMcpPatch({ [name]: undefined }, next)
  }

  const toggleMcpConnection = async (name: string) => {
    const directory = props.directory
    if (!directory) return
    const client = serverSDK().createClient({ directory, throwOnError: true })
    const status = mcpStatus(name)?.status
    if (status === "connecting") return
    setState("togglingMcp", name)
    await (
      status === "connected"
        ? client.mcp.disconnect({ name })
        : status === "needs_auth"
          ? client.mcp.auth.authenticate({ name })
          : client.mcp.connect({ name })
    )
      .then(() => queryClient.refetchQueries(queryOptions().mcp(pathKey(directory))))
      .catch((err: unknown) => {
        showToast({
          variant: "error",
          title: language.t("common.requestFailed"),
          description: err instanceof Error ? err.message : String(err),
        })
      })
      .finally(() => setState("togglingMcp", ""))
  }

  const runMcpProbe = async (name: string, smoke: boolean) => {
    const directory = props.directory
    if (!directory) return
    const client = serverSDK().createClient({ directory, throwOnError: true })
    setProbeState(name, { loading: true })
    await client.mcp
      .probe({ name, smoke })
      .then((res) => {
        setProbeState(name, { loading: false, result: res.data as McpProbeResult })
      })
      .catch((err: unknown) => {
        setProbeState(name, {
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        })
        showToast({
          variant: "error",
          title: language.t("settings.mcp.test.toast.failed.title"),
          description: err instanceof Error ? err.message : String(err),
        })
      })
  }

  const importMcpConfig = () => {
    setState("importingMcp", true)
    try {
      const imported = parseMcpImport(importState.text)
      const existing = mcpConfig()[imported.name]
      const env = isLocalMcp(imported.config) ? { ...(imported.config.environment ?? {}) } : undefined
      const minimaxApiKey = typeof env?.MINIMAX_API_KEY === "string" ? env.MINIMAX_API_KEY : ""
      if (env) delete env.MINIMAX_API_KEY
      setMcpForm({
        editing: existing ? imported.name : "",
        name: imported.name,
        type: imported.config.type,
        command: isLocalMcp(imported.config) ? formatCommandLine(imported.config.command) : "",
        url: isRemoteMcp(imported.config) ? imported.config.url : "",
        enabled: imported.config.enabled ?? true,
        timeout: imported.config.timeout ? String(imported.config.timeout) : "",
        environment: env ? writePairs(env) : "",
        headers: isRemoteMcp(imported.config) ? writePairs(imported.config.headers) : "",
        oauth: isRemoteMcp(imported.config) ? imported.config.oauth !== false : true,
        minimaxApiKey,
      })
      setImportState("error", "")
      showToast({
        variant: "success",
        icon: "circle-check",
        title: language.t("settings.mcp.import.toast.success.title"),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setImportState("error", message)
      showToast({
        variant: "error",
        title: language.t("settings.mcp.import.toast.failed.title"),
        description: message,
      })
    } finally {
      setState("importingMcp", false)
    }
  }

  const editMcp = (name: string, config: McpConfig) => {
    if (!isLocalMcp(config) && !isRemoteMcp(config)) return
    const environment = isLocalMcp(config) ? { ...(config.environment ?? {}) } : undefined
    const minimaxApiKey = typeof environment?.MINIMAX_API_KEY === "string" ? environment.MINIMAX_API_KEY : ""
    if (environment) delete environment.MINIMAX_API_KEY
    setMcpForm({
      editing: name,
      name,
      type: config.type,
      command: isLocalMcp(config) ? formatCommandLine(config.command) : "",
      url: isRemoteMcp(config) ? config.url : "",
      enabled: config.enabled ?? true,
      timeout: config.timeout ? String(config.timeout) : "",
      environment: environment ? writePairs(environment) : "",
      headers: isRemoteMcp(config) ? writePairs(config.headers) : "",
      oauth: isRemoteMcp(config) ? config.oauth !== false : true,
      minimaxApiKey,
    })
  }

  return (
    <div class="flex flex-col gap-8">
      <div class="flex flex-col gap-1">
        <h3 class="text-14-medium text-text-strong pb-2">{language.t("settings.mcp.section.servers")}</h3>
        <SettingsList>
          <Show
            when={mcpItems().length > 0}
            fallback={<div class="py-4 text-14-regular text-text-weak">{language.t("dialog.mcp.empty")}</div>}
          >
            <For each={mcpItems()}>
              {(item) => {
                const runtime = () => mcpStatus(item.name)
                const status = () => runtime()?.status
                const statusLabel = () => {
                  const current = status()
                  if (!current) return
                  return language.t(statusLabels[current])
                }
                const editable = () => isLocalMcp(item.config) || isRemoteMcp(item.config)
                const connecting = () => status() === "connecting"
                return (
                  <div class="flex flex-wrap items-center justify-between gap-4 py-3 border-b border-border-weak-base last:border-none">
                    <div class="flex min-w-0 flex-col gap-1">
                      <div class="flex items-center gap-2 min-w-0">
                        <Icon name="mcp" class="text-icon-weak-base shrink-0" />
                        <span class="text-14-regular text-text-strong truncate">{item.name}</span>
                        <Tag>{mcpConfigKind(item.config)}</Tag>
                        <Show when={statusLabel()}>
                          {(label) => <span class="text-11-regular text-text-weaker">{label()}</span>}
                        </Show>
                      </div>
                      <span class="text-12-regular text-text-weak truncate">{mcpSummary(item.config)}</span>
                      <Show when={mcpStatusError(runtime())}>
                        {(error) => <span class="text-11-regular text-text-weaker truncate">{error()}</span>}
                      </Show>
                    </div>
                    <div class="flex flex-wrap items-center justify-end gap-2">
                      <Switch
                        checked={item.config.enabled ?? true}
                        disabled={state.savingMcp}
                        onChange={(checked) => setMcpEnabled(item.name, checked)}
                      />
                      <Button
                        size="small"
                        variant="secondary"
                        disabled={
                          !props.directory ||
                          connecting() ||
                          state.togglingMcp === item.name ||
                          item.config.enabled === false
                        }
                        onClick={() => void toggleMcpConnection(item.name)}
                      >
                        {status() === "connected"
                          ? language.t("common.disconnect")
                          : connecting()
                            ? language.t("mcp.status.connecting")
                            : status() === "needs_auth"
                              ? language.t("mcp.auth.clickToAuthenticate")
                              : language.t("common.connect")}
                      </Button>
                      <Show when={editable()}>
                        <IconButton
                          icon="edit"
                          variant="ghost"
                          aria-label={language.t("common.edit")}
                          onClick={() => editMcp(item.name, item.config)}
                        />
                      </Show>
                      <IconButton
                        icon="trash"
                        variant="ghost"
                        aria-label={language.t("common.delete")}
                        disabled={state.savingMcp}
                        onClick={() => removeMcp(item.name)}
                      />
                    </div>
                  </div>
                )
              }}
            </For>
          </Show>
        </SettingsList>
      </div>

      <div class="flex flex-col gap-1">
        <h3 class="text-14-medium text-text-strong pb-2">{language.t("settings.mcp.import.title")}</h3>
        <SettingsList>
          <FormRow
            title={language.t("settings.mcp.import.paste")}
            description={language.t("settings.mcp.import.paste.description")}
          >
            <TextField
              label={language.t("settings.mcp.import.paste")}
              hideLabel
              multiline
              value={importState.text}
              onChange={(value) => setImportState("text", value)}
              placeholder={language.t("settings.mcp.import.placeholder")}
              spellcheck={false}
              autocorrect="off"
              autocomplete="off"
              autocapitalize="off"
              class="text-12-regular min-h-32 w-full sm:w-[520px]"
            />
          </FormRow>
          <Show when={importState.error}>
            {(error) => <div class="px-0 py-2 text-12-regular text-text-danger-base">{error()}</div>}
          </Show>
          <div class="flex justify-end gap-2 py-3">
            <Button
              size="small"
              variant="primary"
              icon="plus-small"
              disabled={state.importingMcp || !importState.text.trim()}
              onClick={importMcpConfig}
            >
              {language.t("settings.mcp.import.action")}
            </Button>
          </div>
        </SettingsList>
      </div>

      <div class="flex flex-col gap-1">
        <h3 class="text-14-medium text-text-strong pb-2">{language.t("settings.mcp.test.title")}</h3>
        <SettingsList>
          <Show
            when={mcpItems().length > 0}
            fallback={<div class="py-4 text-14-regular text-text-weak">{language.t("dialog.mcp.empty")}</div>}
          >
            <For each={mcpItems()}>
              {(item) => {
                const probe = () => probeState[item.name]
                const result = () => probe()?.result
                const smoke = () => result()?.smoke
                return (
                  <div class="flex flex-wrap items-center justify-between gap-4 py-3 border-b border-border-weak-base last:border-none">
                    <div class="flex min-w-0 flex-col gap-1">
                      <div class="flex items-center gap-2 min-w-0">
                        <Icon name="mcp" class="text-icon-weak-base shrink-0" />
                        <span class="text-14-regular text-text-strong truncate">{item.name}</span>
                        <Tag>{mcpConfigKind(item.config)}</Tag>
                        <Show when={result()}>
                          {(value) => (
                            <span class="text-11-regular text-text-weaker">
                              {language.t(statusLabels[value().status.status])}
                            </span>
                          )}
                        </Show>
                      </div>
                      <span class="text-12-regular text-text-weak truncate">
                        {result()
                          ? language.t("settings.mcp.test.tools", { count: String(result()!.tools.length) })
                          : language.t("settings.mcp.test.idle")}
                      </span>
                      <Show when={smoke()}>
                        {(value) => (
                          <span class="text-11-regular text-text-weaker truncate">
                            {value().ok
                              ? language.t("settings.mcp.test.smoke.ok")
                              : language.t("settings.mcp.test.smoke.failed", { error: value().error ?? "" })}
                          </span>
                        )}
                      </Show>
                      <Show when={probe()?.error}>
                        {(error) => <span class="text-11-regular text-text-danger-base truncate">{error()}</span>}
                      </Show>
                    </div>
                    <div class="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        size="small"
                        variant="secondary"
                        icon="check"
                        disabled={!props.directory || probe()?.loading}
                        onClick={() => void runMcpProbe(item.name, false)}
                      >
                        {language.t("settings.mcp.test.connection")}
                      </Button>
                      <Button
                        size="small"
                        variant="secondary"
                        icon="check"
                        disabled={!props.directory || probe()?.loading}
                        onClick={() => void runMcpProbe(item.name, true)}
                      >
                        {language.t("settings.mcp.test.smoke")}
                      </Button>
                    </div>
                  </div>
                )
              }}
            </For>
          </Show>
        </SettingsList>
      </div>

      <div class="flex flex-col gap-1">
        <h3 class="text-14-medium text-text-strong pb-2">
          {mcpForm.editing ? language.t("settings.mcp.section.edit") : language.t("settings.mcp.section.add")}
        </h3>
        <SettingsList>
          <FormRow
            title={language.t("settings.mcp.form.name")}
            description={language.t("settings.mcp.form.name.description")}
          >
            <TextField
              label={language.t("settings.mcp.form.name")}
              hideLabel
              value={mcpForm.name}
              onChange={(value) => setMcpForm("name", value)}
              placeholder={language.t("settings.mcp.form.name.placeholder")}
              spellcheck={false}
              autocorrect="off"
              autocomplete="off"
              autocapitalize="off"
              class="text-12-regular w-full sm:w-[320px]"
            />
          </FormRow>
          <FormRow
            title={language.t("settings.mcp.form.type")}
            description={language.t("settings.mcp.form.type.description")}
          >
            <Select
              options={MCP_TYPE_OPTIONS}
              current={MCP_TYPE_OPTIONS.find((item) => item.value === mcpForm.type)}
              value={(item) => item.value}
              label={(item) => item.label}
              onSelect={(item) => item && setMcpForm("type", item.value)}
              variant="secondary"
              size="small"
              triggerVariant="settings"
              triggerStyle={{ "min-width": "180px" }}
            />
          </FormRow>
          <Show
            when={mcpForm.type === "local"}
            fallback={
              <FormRow
                title={language.t("settings.mcp.form.url")}
                description={language.t("settings.mcp.form.url.description")}
              >
                <TextField
                  label={language.t("settings.mcp.form.url")}
                  hideLabel
                  value={mcpForm.url}
                  onChange={(value) => setMcpForm("url", value)}
                  placeholder={language.t("settings.mcp.form.url.placeholder")}
                  spellcheck={false}
                  autocorrect="off"
                  autocomplete="off"
                  autocapitalize="off"
                  class="text-12-regular w-full sm:w-[320px]"
                />
              </FormRow>
            }
          >
            <FormRow
              title={language.t("settings.mcp.form.command")}
              description={language.t("settings.mcp.form.command.description")}
            >
              <TextField
                label={language.t("settings.mcp.form.command")}
                hideLabel
                value={mcpForm.command}
                onChange={(value) => setMcpForm("command", value)}
                placeholder={language.t("settings.mcp.form.command.placeholder")}
                spellcheck={false}
                autocorrect="off"
                autocomplete="off"
                autocapitalize="off"
                class="text-12-regular w-full sm:w-[320px]"
              />
            </FormRow>
          </Show>
          <FormRow
            title={language.t("settings.mcp.form.timeout")}
            description={language.t("settings.mcp.form.timeout.description")}
          >
            <TextField
              label={language.t("settings.mcp.form.timeout")}
              hideLabel
              type="number"
              value={mcpForm.timeout}
              onChange={(value) => setMcpForm("timeout", value)}
              placeholder={language.t("settings.mcp.form.timeout.placeholder")}
              class="text-12-regular w-full sm:w-[180px]"
            />
          </FormRow>
          <Show
            when={mcpForm.type === "local"}
            fallback={
              <>
                <FormRow
                  title={language.t("settings.mcp.form.headers")}
                  description={language.t("settings.mcp.form.headers.description")}
                >
                  <TextField
                    label={language.t("settings.mcp.form.headers")}
                    hideLabel
                    multiline
                    value={mcpForm.headers}
                    onChange={(value) => setMcpForm("headers", value)}
                    placeholder={language.t("settings.mcp.form.pairs.placeholder")}
                    spellcheck={false}
                    autocorrect="off"
                    autocomplete="off"
                    autocapitalize="off"
                    class="text-12-regular min-h-20 w-full sm:w-[320px]"
                  />
                </FormRow>
                <FormRow
                  title={language.t("settings.mcp.form.oauth")}
                  description={language.t("settings.mcp.form.oauth.description")}
                >
                  <Switch checked={mcpForm.oauth} onChange={(checked) => setMcpForm("oauth", checked)} />
                </FormRow>
              </>
            }
          >
            <FormRow
              title={language.t("settings.mcp.form.environment")}
              description={language.t("settings.mcp.form.environment.description")}
            >
              <TextField
                label={language.t("settings.mcp.form.environment")}
                hideLabel
                multiline
                value={mcpForm.environment}
                onChange={(value) => setMcpForm("environment", value)}
                placeholder={language.t("settings.mcp.form.pairs.placeholder")}
                spellcheck={false}
                autocorrect="off"
                autocomplete="off"
                autocapitalize="off"
                class="text-12-regular min-h-20 w-full sm:w-[320px]"
              />
            </FormRow>
            <FormRow
              title={language.t("settings.mcp.form.minimaxApiKey")}
              description={language.t("settings.mcp.form.minimaxApiKey.description")}
            >
              <TextField
                label={language.t("settings.mcp.form.minimaxApiKey")}
                hideLabel
                type="password"
                value={mcpForm.minimaxApiKey}
                onChange={(value) => setMcpForm("minimaxApiKey", value)}
                placeholder={language.t("settings.mcp.form.minimaxApiKey.placeholder")}
                spellcheck={false}
                autocorrect="off"
                autocomplete="off"
                autocapitalize="off"
                class="text-12-regular w-full sm:w-[320px]"
              />
            </FormRow>
          </Show>
          <FormRow
            title={language.t("settings.mcp.form.enabled")}
            description={language.t("settings.mcp.form.enabled.description")}
          >
            <Switch checked={mcpForm.enabled} onChange={(checked) => setMcpForm("enabled", checked)} />
          </FormRow>
          <div class="flex justify-end gap-2 py-3">
            <Show when={mcpForm.editing}>
              <Button size="small" variant="ghost" onClick={resetMcpForm}>
                {language.t("common.cancel")}
              </Button>
            </Show>
            <Button size="small" variant="primary" icon="plus-small" disabled={state.savingMcp} onClick={saveMcp}>
              {mcpForm.editing ? language.t("common.save") : language.t("ui.common.add")}
            </Button>
          </div>
        </SettingsList>
      </div>
    </div>
  )
}

function isLocalMcp(config: McpConfig | undefined): config is McpLocalConfig {
  return !!config && "type" in config && config.type === "local"
}

function isRemoteMcp(config: McpConfig | undefined): config is McpRemoteConfig {
  return !!config && "type" in config && config.type === "remote"
}

function mcpConfigKind(config: McpConfig) {
  if (isLocalMcp(config)) return "Local"
  if (isRemoteMcp(config)) return "Remote"
  return "Override"
}

function mcpSummary(config: McpConfig) {
  if (isLocalMcp(config)) return config.command.join(" ")
  if (isRemoteMcp(config)) return config.url
  return config.enabled ? "enabled" : "disabled"
}

function mcpStatusError(status: McpStatus | undefined) {
  if (!status) return
  if (status.status === "failed" || status.status === "needs_client_registration") return status.error
  return
}

function parseMcpImport(value: string): { name: string; config: McpLocalConfig | McpRemoteConfig } {
  const parsed = parseJsonLike(value)
  const entries = extractMcpEntries(parsed)
  if (entries.length === 0) throw new Error("No MCP server config was found.")

  const preferred = entries.find(([name]) => /minimax/i.test(name)) ?? entries[0]
  const [name, rawConfig] = preferred
  const config = normalizeMcpConfig(rawConfig)
  if (!config) throw new Error("The pasted MCP config is not a supported local or remote server.")
  return { name: sanitizeMcpName(name), config }
}

function parseJsonLike(value: string): unknown {
  const trimmed = value
    .trim()
    .replace(/^```(?:json|javascript|js)?/i, "")
    .replace(/```$/i, "")
    .trim()

  const candidates = [trimmed]
  const first = trimmed.indexOf("{")
  const last = trimmed.lastIndexOf("}")
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1))
  if (!trimmed.startsWith("{")) candidates.push(`{${trimmed}}`)

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {}
  }
  throw new Error("Paste valid JSON from MiniMax --agent-config or an OpenCode MCP config.")
}

function extractMcpEntries(value: unknown): Array<[string, unknown]> {
  if (!isRecord(value)) return []
  for (const key of ["mcp", "mcpServers", "mcp_servers"]) {
    const container = value[key]
    if (isRecord(container)) return Object.entries(container)
  }
  if (isRecord(value.transport)) return [["minimax-bridge", value.transport]]
  if ("type" in value || "command" in value || "url" in value) return [["minimax-bridge", value]]
  const objectEntries = Object.entries(value).filter(([, item]) => isRecord(item))
  return objectEntries.length === 1 ? objectEntries : []
}

function normalizeMcpConfig(value: unknown): McpLocalConfig | McpRemoteConfig | undefined {
  if (!isRecord(value)) return
  const type = typeof value.type === "string" ? value.type : undefined
  if (type === "remote" || typeof value.url === "string") {
    const url = typeof value.url === "string" ? value.url.trim() : ""
    if (!url) return
    const headers = normalizeStringRecord(value.headers)
    return {
      type: "remote",
      url,
      enabled: typeof value.enabled === "boolean" ? value.enabled : true,
      ...(headers ? { headers } : {}),
      ...(value.oauth === false ? { oauth: false as const } : {}),
      ...(typeof value.timeout === "number" ? { timeout: value.timeout } : {}),
    }
  }

  const command = normalizeCommand(value)
  if (command.length === 0) return
  const environment = normalizeStringRecord(value.environment ?? value.env)
  return {
    type: "local",
    command,
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
    ...(environment ? { environment } : {}),
    ...(typeof value.timeout === "number" ? { timeout: value.timeout } : {}),
  }
}

function normalizeCommand(value: Record<string, unknown>): string[] {
  const command = value.command
  const args = Array.isArray(value.args) ? value.args.filter((item): item is string => typeof item === "string") : []
  if (Array.isArray(command)) return command.filter((item): item is string => typeof item === "string")
  if (typeof command === "string") return args.length > 0 ? [command, ...args] : parseCommandLine(command)
  return args
}

function normalizeStringRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return
  const entries = Object.entries(value)
    .filter(([, item]) => item !== undefined && item !== null)
    .map(([key, item]) => [key, typeof item === "string" ? item : JSON.stringify(item)] as const)
  if (entries.length === 0) return
  return Object.fromEntries(entries)
}

function parseCommandLine(value: string) {
  const result: string[] = []
  let current = ""
  let quote: '"' | "'" | "" = ""
  for (let index = 0; index < value.length; index++) {
    const char = value[index]
    if ((char === '"' || char === "'") && !quote) {
      quote = char
      continue
    }
    if (quote && char === quote) {
      quote = ""
      continue
    }
    if (!quote && /\s/.test(char)) {
      if (current) {
        result.push(current)
        current = ""
      }
      continue
    }
    current += char
  }
  if (current) result.push(current)
  return result
}

function formatCommandLine(command: string[]) {
  return command.map((item) => (/\s/.test(item) ? JSON.stringify(item) : item)).join(" ")
}

function sanitizeMcpName(name: string) {
  const trimmed = name.trim()
  return trimmed || "minimax-bridge"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
