import { IconButton } from "@opencode-ai/ui/icon-button"
import { For, Show, type Component, type JSX } from "solid-js"

export function readPairs(value: string) {
  const entries = value
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return
      const index = trimmed.indexOf("=")
      const key = (index === -1 ? trimmed : trimmed.slice(0, index)).trim()
      if (!key) return
      return [key, index === -1 ? "" : trimmed.slice(index + 1).trim()] as const
    })
    .filter((item): item is readonly [string, string] => !!item)
  if (entries.length === 0) return
  return Object.fromEntries(entries)
}

export function writePairs(value: Record<string, unknown> | undefined) {
  if (!value) return ""
  return Object.entries(value)
    .map(([key, item]) => `${key}=${typeof item === "string" ? item : JSON.stringify(item)}`)
    .join("\n")
}

export function uniqueList(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)))
}

export const SourceList: Component<{
  empty: string
  items: string[]
  onRemove: (item: string) => void
}> = (props) => (
  <Show when={props.items.length > 0} fallback={<span class="text-12-regular text-text-weak">{props.empty}</span>}>
    <div class="flex flex-col gap-1">
      <For each={props.items}>
        {(item) => (
          <div class="flex items-center justify-between gap-2 rounded-md bg-surface-raised-base px-2 py-1">
            <span class="text-12-regular text-text-base truncate">{item}</span>
            <IconButton icon="trash" variant="ghost" size="small" onClick={() => props.onRemove(item)} />
          </div>
        )}
      </For>
    </div>
  </Show>
)

export const FormRow: Component<{
  title: string
  description: string
  children: JSX.Element
}> = (props) => (
  <div class="flex flex-wrap items-start gap-4 py-3 border-b border-border-weak-base last:border-none sm:flex-nowrap">
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="text-14-medium text-text-strong">{props.title}</span>
      <span class="text-12-regular text-text-weak">{props.description}</span>
    </div>
    <div class="flex w-full justify-end sm:w-auto sm:shrink-0">{props.children}</div>
  </div>
)
