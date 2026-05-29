import { useParams } from "@solidjs/router"
import { createMemo, createSignal, For, type Component } from "solid-js"
import { useLanguage } from "@/context/language"
import { decode64 } from "@/utils/base64"
import { SettingsMcpPanel } from "./settings-plugins/mcp"
import { SettingsPluginPanel } from "./settings-plugins/plugins"
import { SettingsSkillsPanel } from "./settings-plugins/skills"

type PluginTab = "plugins" | "skills" | "mcp"

const TABS: PluginTab[] = ["plugins", "skills", "mcp"]

export const SettingsPlugins: Component = () => {
  const language = useLanguage()
  const params = useParams()

  const directory = createMemo(() => decode64(params.dir) ?? "")
  const [activeTab, setActiveTab] = createSignal<PluginTab>("plugins")

  const tabLabel = (tab: PluginTab) => {
    if (tab === "plugins") return language.t("settings.plugins.tab.plugins")
    if (tab === "skills") return language.t("settings.plugins.tab.skills")
    return language.t("settings.plugins.tab.mcp")
  }

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar px-4 pb-10 sm:px-10 sm:pb-10">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-col gap-4 pt-6 pb-6 max-w-[820px]">
          <h2 class="text-16-medium text-text-strong">{language.t("settings.plugins.title")}</h2>
        </div>
      </div>

      <div class="flex flex-col gap-6 max-w-[820px]">
        <div role="tablist" class="flex w-fit items-center gap-1 rounded-lg bg-surface-base p-1">
          <For each={TABS}>
            {(tab) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab() === tab}
                class="h-8 rounded-md px-3 text-12-regular transition-colors"
                classList={{
                  "bg-surface-raised-base text-text-strong": activeTab() === tab,
                  "text-text-weak hover:text-text-base": activeTab() !== tab,
                }}
                onClick={() => setActiveTab(tab)}
              >
                {tabLabel(tab)}
              </button>
            )}
          </For>
        </div>

        <div classList={{ hidden: activeTab() !== "plugins" }}>
          <SettingsPluginPanel />
        </div>
        <div classList={{ hidden: activeTab() !== "skills" }}>
          <SettingsSkillsPanel directory={directory()} />
        </div>
        <div classList={{ hidden: activeTab() !== "mcp" }}>
          <SettingsMcpPanel directory={directory()} />
        </div>
      </div>
    </div>
  )
}
