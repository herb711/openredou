import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { Popover } from "@opencode-ai/ui/popover"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/components/icon.jsx"
import { IconButtonV2 } from "@opencode-ai/ui/v2/components/icon-button-v2.jsx"
import type { Message } from "@opencode-ai/sdk/v2/client"
import { createMemo, createSignal, For, Show, type JSX } from "solid-js"
import { DebugBarPanel } from "@/components/debug-bar"
import { useLanguage } from "@/context/language"
import { useSync } from "@/context/sync"
import { useProviders } from "@/hooks/use-providers"
import { useSessionLayout } from "@/pages/session/session-layout"
import { getSessionContextMetrics } from "./session-context-metrics"
import { createSessionContextFormatter } from "./session-context-format"

function InfoStat(props: { label: string; value: JSX.Element }) {
  return (
    <div class="min-w-0 rounded-lg border border-border-weak-base bg-surface-base px-3 py-2">
      <div class="text-11-regular text-text-weak">{props.label}</div>
      <div class="mt-1 truncate text-12-medium text-text-strong">{props.value}</div>
    </div>
  )
}

export function SessionInfoPopover(props: { variant: "legacy" | "v2" }) {
  const sync = useSync()
  const language = useLanguage()
  const providers = useProviders()
  const { params } = useSessionLayout()
  const [shown, setShown] = createSignal(false)
  const label = () => language.t("context.stats.session")

  const info = createMemo(() => (params.id ? sync.session.get(params.id) : undefined))
  const messages = createMemo(() => (params.id ? ((sync.data.message[params.id] ?? []) as Message[]) : []))
  const metrics = createMemo(() => getSessionContextMetrics(messages(), [...providers.all().values()]))
  const ctx = createMemo(() => metrics().context)
  const formatter = createMemo(() => createSessionContextFormatter(language.intl()))
  const cost = createMemo(() =>
    new Intl.NumberFormat(language.intl(), {
      style: "currency",
      currency: "USD",
    }).format(metrics().totalCost),
  )
  const counts = createMemo(() => ({
    all: messages().length,
  }))

  const stats = [
    { label: "context.stats.messages", value: () => counts().all.toLocaleString(language.intl()) },
    { label: "context.stats.provider", value: () => ctx()?.providerLabel ?? formatter().number(undefined) },
    { label: "context.stats.model", value: () => ctx()?.modelLabel ?? formatter().number(undefined) },
    { label: "context.stats.totalCost", value: cost },
    { label: "context.stats.sessionCreated", value: () => formatter().time(info()?.time.created) },
    { label: "context.stats.lastActivity", value: () => formatter().time(ctx()?.message.time.created) },
  ] satisfies { label: Parameters<typeof language.t>[0]; value: () => JSX.Element }[]

  const body = () => (
    <Show when={shown()}>
      <div class="max-h-[calc(100vh-76px)] w-[360px] max-w-[calc(100vw-40px)] overflow-auto rounded-xl border border-border-base bg-background-strong shadow-[var(--shadow-lg-border-base)]">
        <div class="border-b border-border-weak-base px-4 py-3">
          <div class="text-12-medium text-text-strong">{label()}</div>
          <div class="mt-0.5 truncate text-11-regular text-text-weak">{info()?.title ?? params.id}</div>
        </div>
        <div class="flex flex-col gap-4 p-3">
          <div class="grid grid-cols-2 gap-2">
            <For each={stats}>{(stat) => <InfoStat label={language.t(stat.label)} value={stat.value()} />}</For>
          </div>

          <Show when={import.meta.env.DEV}>
            <div class="flex flex-col gap-2">
              <div class="text-11-regular text-text-weak">{language.t("debugBar.ariaLabel")}</div>
              <div
                aria-label={language.t("debugBar.ariaLabel")}
                class="overflow-hidden rounded-lg border border-border-weak-base bg-surface-raised-stronger-non-alpha p-0.5"
              >
                <DebugBarPanel />
              </div>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  )

  const popoverProps = {
    class: "[&_[data-slot=popover-body]]:p-0 bg-transparent border-0 shadow-none rounded-xl",
    gutter: 4,
    placement: "bottom-end" as const,
    shift: -168,
  }

  return (
    <Show when={params.id}>
      <Show
        when={props.variant === "v2"}
        fallback={
          <Popover
            open={shown()}
            onOpenChange={setShown}
            triggerAs={Button}
            triggerProps={{
              variant: "ghost",
              class: "titlebar-icon w-8 h-6 p-0 box-border",
              classList: { "bg-surface-raised-base-active": shown() },
              "aria-label": label(),
            }}
            trigger={<Icon name="help" size="small" />}
            {...popoverProps}
          >
            {body()}
          </Popover>
        }
      >
        <Popover
          open={shown()}
          onOpenChange={setShown}
          triggerAs={IconButtonV2}
          triggerProps={{
            variant: "ghost-muted",
            size: "large",
            class: "!w-9 shrink-0",
            state: shown() ? "pressed" : undefined,
            "aria-label": label(),
          }}
          trigger={<IconV2 name="help" />}
          {...popoverProps}
        >
          {body()}
        </Popover>
      </Show>
    </Show>
  )
}
