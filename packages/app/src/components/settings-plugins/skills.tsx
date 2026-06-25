import type { AppSkillsResponses, Config } from "@opencode-ai/sdk/v2/client"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { TextField } from "@opencode-ai/ui/text-field"
import { showToast } from "@opencode-ai/ui/toast"
import { createMemo, createResource, createSignal, For, Show, type Component } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { useServerSDK } from "@/context/server-sdk"
import { useServerSync } from "@/context/server-sync"
import { SettingsList } from "../settings-list"
import { FormRow, SourceList, uniqueList } from "./common"

type SkillItem = AppSkillsResponses[200][number]

export const SettingsSkillsPanel: Component<{ directory: string }> = (props) => {
  const language = useLanguage()
  const serverSDK = useServerSDK()
  const serverSync = useServerSync()

  const skillsConfig = createMemo(() => serverSync().data.config.skills ?? {})
  const [skillSearch, setSkillSearch] = createSignal("")
  const [skillForm, setSkillForm] = createStore({
    path: "",
    url: "",
  })
  const [saving, setSaving] = createStore({ skills: false })

  const [skills, { refetch: refetchSkills }] = createResource(
    () => props.directory,
    (dir) => {
      if (!dir) return Promise.resolve([] as SkillItem[])
      return serverSDK()
        .createClient({ directory: dir, throwOnError: true })
        .app.skills({ directory: dir })
        .then((res) => res.data ?? [])
        .catch(() => [] as SkillItem[])
    },
    { initialValue: [] as SkillItem[] },
  )

  const filteredSkills = createMemo(() => {
    const filter = skillSearch().trim().toLowerCase()
    if (!filter) return skills.latest
    return skills.latest.filter((item) =>
      [item.name, item.description ?? "", item.location].some((value) => value.toLowerCase().includes(filter)),
    )
  })

  const saveSkills = async (next: NonNullable<Config["skills"]>) => {
    const before = skillsConfig()
    setSaving("skills", true)
    serverSync().set("config", "skills", next)
    await serverSync()
      .updateConfig({ skills: next })
      .then(() => {
        showToast({ variant: "success", icon: "circle-check", title: language.t("settings.skills.toast.saved.title") })
        void refetchSkills()
      })
      .catch((err: unknown) => {
        serverSync().set("config", "skills", before)
        showToast({
          variant: "error",
          title: language.t("settings.skills.toast.failed.title"),
          description: err instanceof Error ? err.message : String(err),
        })
      })
      .finally(() => setSaving("skills", false))
  }

  const addSkillPath = () => {
    const value = skillForm.path.trim()
    if (!value) return
    setSkillForm("path", "")
    void saveSkills({
      paths: uniqueList([...(skillsConfig().paths ?? []), value]),
      urls: uniqueList(skillsConfig().urls ?? []),
    })
  }

  const addSkillUrl = () => {
    const value = skillForm.url.trim()
    if (!value) return
    setSkillForm("url", "")
    void saveSkills({
      paths: uniqueList(skillsConfig().paths ?? []),
      urls: uniqueList([...(skillsConfig().urls ?? []), value]),
    })
  }

  const removeSkillPath = (value: string) => {
    void saveSkills({
      paths: (skillsConfig().paths ?? []).filter((item) => item !== value),
      urls: uniqueList(skillsConfig().urls ?? []),
    })
  }

  const removeSkillUrl = (value: string) => {
    void saveSkills({
      paths: uniqueList(skillsConfig().paths ?? []),
      urls: (skillsConfig().urls ?? []).filter((item) => item !== value),
    })
  }

  return (
    <div class="flex flex-col gap-8">
      <div class="flex flex-col gap-1">
        <h3 class="text-14-medium text-text-strong pb-2">{language.t("settings.skills.section.sources")}</h3>
        <SettingsList>
          <FormRow
            title={language.t("settings.skills.paths.title")}
            description={language.t("settings.skills.paths.description")}
          >
            <div class="flex w-full flex-col gap-2 sm:w-[360px]">
              <div class="flex gap-2">
                <TextField
                  label={language.t("settings.skills.paths.title")}
                  hideLabel
                  value={skillForm.path}
                  onChange={(value) => setSkillForm("path", value)}
                  placeholder={language.t("settings.skills.addPath.placeholder")}
                  spellcheck={false}
                  autocorrect="off"
                  autocomplete="off"
                  autocapitalize="off"
                  class="text-12-regular flex-1"
                />
                <IconButton
                  icon="plus-small"
                  variant="secondary"
                  aria-label={language.t("ui.common.add")}
                  disabled={saving.skills}
                  onClick={addSkillPath}
                />
              </div>
              <SourceList
                empty={language.t("settings.skills.empty.paths")}
                items={skillsConfig().paths ?? []}
                onRemove={removeSkillPath}
              />
            </div>
          </FormRow>
          <FormRow
            title={language.t("settings.skills.urls.title")}
            description={language.t("settings.skills.urls.description")}
          >
            <div class="flex w-full flex-col gap-2 sm:w-[360px]">
              <div class="flex gap-2">
                <TextField
                  label={language.t("settings.skills.urls.title")}
                  hideLabel
                  value={skillForm.url}
                  onChange={(value) => setSkillForm("url", value)}
                  placeholder={language.t("settings.skills.addUrl.placeholder")}
                  spellcheck={false}
                  autocorrect="off"
                  autocomplete="off"
                  autocapitalize="off"
                  class="text-12-regular flex-1"
                />
                <IconButton
                  icon="plus-small"
                  variant="secondary"
                  aria-label={language.t("ui.common.add")}
                  disabled={saving.skills}
                  onClick={addSkillUrl}
                />
              </div>
              <SourceList
                empty={language.t("settings.skills.empty.urls")}
                items={skillsConfig().urls ?? []}
                onRemove={removeSkillUrl}
              />
            </div>
          </FormRow>
        </SettingsList>
      </div>

      <div class="flex flex-col gap-1">
        <div class="flex flex-wrap items-center justify-between gap-3 pb-2">
          <h3 class="text-14-medium text-text-strong">{language.t("settings.skills.section.available")}</h3>
          <div class="flex items-center gap-2 px-3 h-9 rounded-lg bg-surface-base min-w-0 w-full sm:w-[280px]">
            <Icon name="magnifying-glass" class="text-icon-weak-base shrink-0" />
            <TextField
              variant="ghost"
              type="text"
              value={skillSearch()}
              onChange={setSkillSearch}
              placeholder={language.t("settings.skills.search.placeholder")}
              spellcheck={false}
              autocorrect="off"
              autocomplete="off"
              autocapitalize="off"
              class="flex-1"
            />
            <Show when={skillSearch()}>
              <IconButton icon="circle-x" variant="ghost" onClick={() => setSkillSearch("")} />
            </Show>
          </div>
        </div>
        <SettingsList>
          <Show
            when={props.directory}
            fallback={
              <div class="py-4 text-14-regular text-text-weak">
                {language.t("settings.skills.currentProjectRequired")}
              </div>
            }
          >
            <Show
              when={filteredSkills().length > 0}
              fallback={
                <div class="py-4 text-14-regular text-text-weak">
                  {skills.loading
                    ? `${language.t("common.loading")}${language.t("common.loading.ellipsis")}`
                    : language.t("settings.skills.empty.available")}
                </div>
              }
            >
              <For each={filteredSkills()}>
                {(item) => (
                  <div class="flex flex-col gap-1 py-3 border-b border-border-weak-base last:border-none">
                    <div class="flex items-center gap-2 min-w-0">
                      <Icon name="checklist" class="text-icon-weak-base shrink-0" />
                      <span class="text-14-regular text-text-strong truncate">{item.name}</span>
                    </div>
                    <Show when={item.description}>
                      {(description) => <span class="text-12-regular text-text-weak">{description()}</span>}
                    </Show>
                    <span class="text-11-regular text-text-weaker truncate">{item.location}</span>
                  </div>
                )}
              </For>
            </Show>
          </Show>
        </SettingsList>
      </div>
    </div>
  )
}
