import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiError, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import { WorkspaceRoutingMiddleware, WorkspaceRoutingQuery } from "../middleware/workspace-routing"
import { described } from "./metadata"

const RuleFile = Schema.Struct({
  path: Schema.String,
  content: Schema.String,
}).annotate({ identifier: "RuleFile" })

export const RulesInfo = Schema.Struct({
  global: RuleFile,
  project: RuleFile,
}).annotate({ identifier: "RulesInfo" })

export const RulesUpdatePayload = Schema.Struct({
  global: Schema.String,
  project: Schema.String,
})

export const RulesPaths = {
  get: "/rules",
  update: "/rules",
} as const

export const RulesApi = HttpApi.make("rules")
  .add(
    HttpApiGroup.make("rules")
      .add(
        HttpApiEndpoint.get("get", RulesPaths.get, {
          query: WorkspaceRoutingQuery,
          success: described(RulesInfo, "Workspace rules"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "rules.get",
            summary: "Get rules",
            description: "Read global and project AGENTS.md instruction files for the current workspace.",
          }),
        ),
        HttpApiEndpoint.patch("update", RulesPaths.update, {
          query: WorkspaceRoutingQuery,
          payload: RulesUpdatePayload,
          success: described(RulesInfo, "Workspace rules updated"),
          error: HttpApiError.BadRequest,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "rules.update",
            summary: "Update rules",
            description: "Update global and project AGENTS.md instruction files for the current workspace.",
          }),
        ),
      )
      .annotateMerge(OpenApi.annotations({ title: "rules", description: "Workspace rule file routes." }))
      .middleware(InstanceContextMiddleware)
      .middleware(WorkspaceRoutingMiddleware)
      .middleware(Authorization),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "opencode rules HttpApi",
      version: "0.0.1",
      description: "HttpApi surface for editing global and project rule files.",
    }),
  )
