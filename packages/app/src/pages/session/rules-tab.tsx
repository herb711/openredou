import { Button } from "@opencode-ai/ui/button"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { showToast } from "@opencode-ai/ui/toast"
import { createQuery, useMutation, useQueryClient } from "@tanstack/solid-query"
import { createEffect, createMemo, on, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { useSDK } from "@/context/sdk"
import { formatServerError } from "@/utils/server-errors"

function RuleEditor(props: {
  title: string
  path: string
  value: string
  disabled: boolean
  onInput: (value: string) => void
}): JSX.Element {
  return (
    <section class="min-h-0 flex-1 flex flex-col gap-2">
      <div class="min-w-0 flex items-center justify-between gap-3">
        <div class="shrink-0 text-12-medium text-text-strong">{props.title}</div>
        <div class="min-w-0 truncate text-11-regular text-text-weaker" title={props.path}>
          {props.path}
        </div>
      </div>
      <textarea
        value={props.value}
        disabled={props.disabled}
        spellcheck={false}
        autocorrect="off"
        autocomplete="off"
        autocapitalize="off"
        class="min-h-0 flex-1 resize-none rounded-md border border-border-base bg-surface-base px-3 py-2 font-mono text-12-regular text-text-strong outline-none focus:border-border-strong-base disabled:opacity-70"
        onInput={(event) => props.onInput(event.currentTarget.value)}
      />
    </section>
  )
}

export function SessionRulesTab() {
  const sdk = useSDK()
  const language = useLanguage()
  const queryClient = useQueryClient()
  const queryKey = () => ["rules", sdk().directory] as const
  const [state, setState] = createStore({
    global: "",
    project: "",
    sourceGlobal: "",
    sourceProject: "",
  })

  const rules = createQuery(() => ({
    queryKey: queryKey(),
    queryFn: () => sdk().client.rules.get().then((result) => result.data!),
  }))

  const dirty = createMemo(() => state.global !== state.sourceGlobal || state.project !== state.sourceProject)

  createEffect(
    on(
      () => rules.data,
      (data) => {
        if (!data) return
        if (dirty()) return
        setState({
          global: data.global.content,
          project: data.project.content,
          sourceGlobal: data.global.content,
          sourceProject: data.project.content,
        })
      },
    ),
  )

  const save = useMutation(() => ({
    mutationFn: () =>
      sdk().client.rules
        .update({
          global: state.global,
          project: state.project,
        })
        .then((result) => result.data!),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey(), data)
      setState({
        global: data.global.content,
        project: data.project.content,
        sourceGlobal: data.global.content,
        sourceProject: data.project.content,
      })
      showToast({ variant: "success", icon: "circle-check", title: language.t("session.rules.saved") })
    },
    onError: (error) => {
      showToast({
        variant: "error",
        title: language.t("common.requestFailed"),
        description: formatServerError(error, language.t),
      })
    },
  }))

  const saveRules = () => {
    if (!rules.data) return
    if (!dirty()) return
    if (save.isPending) return
    save.mutate()
  }

  return (
    <ScrollView class="h-full">
      <div class="h-full min-h-[34rem] px-6 py-4 flex flex-col gap-4">
        <div class="shrink-0 flex items-center justify-between gap-3">
          <div class="text-12-regular text-text-weak">
            <Show when={rules.isPending}>{language.t("common.loading")}</Show>
            <Show when={rules.isError}>{language.t("common.requestFailed")}</Show>
          </div>
          <Button
            size="small"
            variant="primary"
            disabled={!rules.data || !dirty() || save.isPending}
            onClick={saveRules}
          >
            {save.isPending ? language.t("common.saving") : language.t("common.save")}
          </Button>
        </div>
        <RuleEditor
          title={language.t("session.rules.global")}
          path={rules.data?.global.path ?? ""}
          value={state.global}
          disabled={!rules.data || rules.isPending || save.isPending}
          onInput={(value) => setState("global", value)}
        />
        <RuleEditor
          title={language.t("session.rules.project")}
          path={rules.data?.project.path ?? ""}
          value={state.project}
          disabled={!rules.data || rules.isPending || save.isPending}
          onInput={(value) => setState("project", value)}
        />
      </div>
    </ScrollView>
  )
}
