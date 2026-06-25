import * as InstanceState from "@/effect/instance-state"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Global } from "@opencode-ai/core/global"
import { Effect } from "effect"
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi"
import path from "path"
import { InstanceHttpApi } from "../api"
import { RulesUpdatePayload } from "../groups/rules"

const filename = "AGENTS.md"

export const rulesHandlers = HttpApiBuilder.group(InstanceHttpApi, "rules", (handlers) =>
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service

    const read = Effect.fnUntraced(function* (filepath: string) {
      return (yield* fs.readFileStringSafe(filepath).pipe(Effect.catch(() => Effect.succeed(undefined)))) ?? ""
    })

    const paths = Effect.fnUntraced(function* () {
      const ctx = yield* InstanceState.context
      return {
        global: path.join(Global.make().config, filename),
        project: path.join(ctx.directory, filename),
      }
    })

    const get = Effect.fn("RulesHttpApi.get")(function* () {
      const rulePaths = yield* paths()
      return {
        global: {
          path: rulePaths.global,
          content: yield* read(rulePaths.global),
        },
        project: {
          path: rulePaths.project,
          content: yield* read(rulePaths.project),
        },
      }
    })

    const update = Effect.fn("RulesHttpApi.update")(function* (ctx: { payload: typeof RulesUpdatePayload.Type }) {
      const rulePaths = yield* paths()
      yield* Effect.all([
        fs.writeWithDirs(rulePaths.global, ctx.payload.global),
        fs.writeWithDirs(rulePaths.project, ctx.payload.project),
      ]).pipe(Effect.catch(() => Effect.fail(new HttpApiError.BadRequest({}))))
      return yield* get()
    })

    return handlers.handle("get", get).handle("update", update)
  }),
)
