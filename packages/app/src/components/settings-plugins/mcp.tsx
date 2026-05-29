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

const MCP_TYPE_OPTIONS: Array<{ value: McpType; label: string }> = [
  { value: "local", label: "Local" },
  { value: "remote", label: "Remote" },
]

const statusLabels = {
  connected: "mcp.status.connected",
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

  const mcpConfig = createMemo(() => serverSync.data.config.mcp ?? {})
  const mcpItems = createMemo(() =>
    Object.entries(mcpConfig())
      .map(([name, config]) => ({ name, config }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  )
  const [state, setState] = createStore({
    savingMcp: false,
    togglingMcp: "",
  })
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
    })
  }

  const mcpStatus = (name: string): McpStatus | undefined => {
    if (!props.directory) return
    return serverSync.peek(props.directory)[0].mcp?.[name]
  }

  const saveMcpPatch = async (patch: Record<string, McpConfig | undefined>, next: NonNullable<Config["mcp"]>) => {
    const before = mcpConfig()
    setState("savingMcp", true)
    serverSync.set("config", "mcp", next)
    await serverSync
      .updateConfig({ mcp: patch as NonNullable<Config["mcp"]> })
      .then(() => {
        resetMcpForm()
        showToast({ variant: "success", icon: "circle-check", title: language.t("settings.mcp.toast.saved.title") })
        if (props.directory) void queryClient.refetchQueries(queryOptions.mcp(pathKey(props.directory)))
      })
      .catch((err: unknown) => {
        serverSync.set("config", "mcp", before)
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
    const command = mcpForm.command.trim().split(/\s+/).filter(Boolean)
    if (command.length === 0) {
      showToast({ title: language.t("settings.mcp.validation.command") })
      return
    }
    const environment = readPairs(mcpForm.environment)
    return {
      type: "local",
      command,
      enabled: mcpForm.enabled,
      ...(environment ? { environment } : {}),
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
    const client = serverSDK.createClient({ directory, throwOnError: true })
    const status = mcpStatus(name)?.status
    setState("togglingMcp", name)
    await (
      status === "connected"
        ? client.mcp.disconnect({ name })
        : status === "needs_auth"
          ? client.mcp.auth.authenticate({ name })
          : client.mcp.connect({ name })
    )
      .then(() => queryClient.refetchQueries(queryOptions.mcp(pathKey(directory))))
      .catch((err: unknown) => {
        showToast({
          variant: "error",
          title: language.t("common.requestFailed"),
          description: err instanceof Error ? err.message : String(err),
        })
      })
      .finally(() => setState("togglingMcp", ""))
  }

  const editMcp = (name: string, config: McpConfig) => {
    if (!isLocalMcp(config) && !isRemoteMcp(config)) return
    setMcpForm({
      editing: name,
      name,
      type: config.type,
      command: isLocalMcp(config) ? config.command.join(" ") : "",
      url: isRemoteMcp(config) ? config.url : "",
      enabled: config.enabled ?? true,
      timeout: config.timeout ? String(config.timeout) : "",
      environment: isLocalMcp(config) ? writePairs(config.environment) : "",
      headers: isRemoteMcp(config) ? writePairs(config.headers) : "",
      oauth: isRemoteMcp(config) ? config.oauth !== false : true,
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
                        disabled={!props.directory || state.togglingMcp === item.name || item.config.enabled === false}
                        onClick={() => void toggleMcpConnection(item.name)}
                      >
                        {status() === "connected"
                          ? language.t("common.disconnect")
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
