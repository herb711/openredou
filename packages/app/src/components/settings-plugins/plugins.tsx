import type { Config } from "@opencode-ai/sdk/v2/client"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tag } from "@opencode-ai/ui/tag"
import { TextField } from "@opencode-ai/ui/text-field"
import { showToast } from "@opencode-ai/ui/toast"
import { createMemo, For, Show, type Component } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { useServerSync } from "@/context/server-sync"
import { SettingsList } from "../settings-list"
import { FormRow, readPairs, writePairs } from "./common"

type PluginEntry = NonNullable<Config["plugin"]>[number]

export const SettingsPluginPanel: Component = () => {
  const language = useLanguage()
  const serverSync = useServerSync()

  const pluginConfig = createMemo(() => serverSync().data.config.plugin ?? [])
  const [pluginForm, setPluginForm] = createStore({
    editing: -1,
    source: "",
    options: "",
  })
  const [saving, setSaving] = createStore({ plugins: false })

  const resetPluginForm = () => {
    setPluginForm({
      editing: -1,
      source: "",
      options: "",
    })
  }

  const savePlugin = async () => {
    const source = pluginForm.source.trim()
    if (!source) {
      showToast({ title: language.t("settings.plugins.validation.source") })
      return
    }

    const before = pluginConfig()
    const next = before.slice()
    const entry = pluginEntry(source, readPairs(pluginForm.options))
    if (pluginForm.editing >= 0) next[pluginForm.editing] = entry
    if (pluginForm.editing < 0) next.push(entry)

    setSaving("plugins", true)
    serverSync().set("config", "plugin", next)
    await serverSync()
      .updateConfig({ plugin: next })
      .then(() => {
        resetPluginForm()
        showToast({ variant: "success", icon: "circle-check", title: language.t("settings.plugins.toast.saved.title") })
      })
      .catch((err: unknown) => {
        serverSync().set("config", "plugin", before)
        showToast({
          variant: "error",
          title: language.t("settings.plugins.toast.failed.title"),
          description: err instanceof Error ? err.message : String(err),
        })
      })
      .finally(() => setSaving("plugins", false))
  }

  const removePlugin = async (index: number) => {
    const before = pluginConfig()
    const next = before.filter((_, i) => i !== index)
    setSaving("plugins", true)
    serverSync().set("config", "plugin", next)
    await serverSync()
      .updateConfig({ plugin: next })
      .then(() => {
        resetPluginForm()
        showToast({ variant: "success", icon: "circle-check", title: language.t("settings.plugins.toast.saved.title") })
      })
      .catch((err: unknown) => {
        serverSync().set("config", "plugin", before)
        showToast({
          variant: "error",
          title: language.t("settings.plugins.toast.failed.title"),
          description: err instanceof Error ? err.message : String(err),
        })
      })
      .finally(() => setSaving("plugins", false))
  }

  return (
    <div class="flex flex-col gap-8">
      <div class="flex flex-col gap-1">
        <h3 class="text-14-medium text-text-strong pb-2">{language.t("settings.plugins.section.configured")}</h3>
        <SettingsList>
          <Show
            when={pluginConfig().length > 0}
            fallback={
              <div class="py-4 text-14-regular text-text-weak">{language.t("settings.plugins.configured.empty")}</div>
            }
          >
            <For each={pluginConfig()}>
              {(item, index) => (
                <div class="flex flex-wrap items-center justify-between gap-4 py-3 border-b border-border-weak-base last:border-none">
                  <div class="flex min-w-0 flex-col gap-1">
                    <div class="flex items-center gap-2 min-w-0">
                      <Icon name="mcp" class="text-icon-weak-base shrink-0" />
                      <span class="text-14-regular text-text-strong truncate">{pluginSource(item)}</span>
                      <Tag>{pluginKind(pluginSource(item))}</Tag>
                    </div>
                    <Show when={pluginOptions(item)}>
                      {(options) => (
                        <span class="text-12-regular text-text-weak truncate">{writePairs(options())}</span>
                      )}
                    </Show>
                  </div>
                  <div class="flex items-center gap-1">
                    <IconButton
                      icon="edit"
                      variant="ghost"
                      aria-label={language.t("common.edit")}
                      onClick={() => {
                        setPluginForm({
                          editing: index(),
                          source: pluginSource(item),
                          options: writePairs(pluginOptions(item)),
                        })
                      }}
                    />
                    <IconButton
                      icon="trash"
                      variant="ghost"
                      aria-label={language.t("common.delete")}
                      disabled={saving.plugins}
                      onClick={() => void removePlugin(index())}
                    />
                  </div>
                </div>
              )}
            </For>
          </Show>
        </SettingsList>
      </div>

      <div class="flex flex-col gap-1">
        <h3 class="text-14-medium text-text-strong pb-2">
          {pluginForm.editing >= 0
            ? language.t("settings.plugins.section.edit")
            : language.t("settings.plugins.section.add")}
        </h3>
        <SettingsList>
          <FormRow
            title={language.t("settings.plugins.form.source.title")}
            description={language.t("settings.plugins.form.source.description")}
          >
            <TextField
              label={language.t("settings.plugins.form.source.title")}
              hideLabel
              value={pluginForm.source}
              onChange={(value) => setPluginForm("source", value)}
              placeholder={language.t("settings.plugins.form.source.placeholder")}
              spellcheck={false}
              autocorrect="off"
              autocomplete="off"
              autocapitalize="off"
              class="text-12-regular w-full sm:w-[320px]"
            />
          </FormRow>
          <FormRow
            title={language.t("settings.plugins.form.options.title")}
            description={language.t("settings.plugins.form.options.description")}
          >
            <TextField
              label={language.t("settings.plugins.form.options.title")}
              hideLabel
              multiline
              value={pluginForm.options}
              onChange={(value) => setPluginForm("options", value)}
              placeholder={language.t("settings.plugins.form.options.placeholder")}
              spellcheck={false}
              autocorrect="off"
              autocomplete="off"
              autocapitalize="off"
              class="text-12-regular min-h-20 w-full sm:w-[320px]"
            />
          </FormRow>
          <div class="flex justify-end gap-2 py-3">
            <Show when={pluginForm.editing >= 0}>
              <Button size="small" variant="ghost" onClick={resetPluginForm}>
                {language.t("common.cancel")}
              </Button>
            </Show>
            <Button
              size="small"
              variant="primary"
              icon="plus-small"
              disabled={saving.plugins}
              onClick={() => void savePlugin()}
            >
              {pluginForm.editing >= 0 ? language.t("common.save") : language.t("ui.common.add")}
            </Button>
          </div>
        </SettingsList>
      </div>
    </div>
  )
}

function pluginEntry(source: string, options: Record<string, string> | undefined): PluginEntry {
  if (!options) return source
  return [source, options]
}

function pluginSource(entry: PluginEntry) {
  if (typeof entry === "string") return entry
  return entry[0]
}

function pluginOptions(entry: PluginEntry) {
  if (typeof entry === "string") return
  return entry[1]
}

function pluginKind(source: string) {
  if (/^https?:\/\//.test(source)) return "URL"
  if (
    source.startsWith("file://") ||
    source.startsWith(".") ||
    source.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(source)
  ) {
    return "File"
  }
  return "Package"
}
