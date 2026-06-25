import { expect, test, type Page, type Route } from "@playwright/test"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { mockOpenCodeServer } from "../utils/mock-server"

const directory = "C:/OpenRedou/FeatureSmoke"
const projectID = "proj_openredou_feature_smoke"
const sessionID = "ses_openredou_feature_smoke"
type RulePayload = { global?: string; project?: string }

test("preserves OpenRedou settings, rules, and session controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const requests: { rules?: RulePayload; config?: unknown } = {}
  await mockOpenCodeServer(page, {
    directory,
    project: {
      id: projectID,
      worktree: directory,
      vcs: "git",
      name: "FeatureSmoke",
      time: { created: 1700000000000, updated: 1700000000000 },
      sandboxes: [],
    },
    provider: {
      all: [
        {
          id: "opencode",
          name: "OpenCode",
          models: {
            "test-model": {
              id: "test-model",
              name: "Test Model",
              limit: { context: 200_000 },
            },
          },
        },
      ],
      connected: ["opencode"],
      default: { providerID: "opencode", modelID: "test-model" },
    },
    sessions: [
      {
        id: sessionID,
        slug: "openredou-feature-smoke",
        projectID,
        directory,
        title: "OpenRedou feature smoke",
        version: "dev",
        time: { created: 1700000000000, updated: 1700000000000 },
      },
    ],
    pageMessages: () => ({ items: [] }),
  })
  await mockFeatureRoutes(page, requests)
  await page.addInitScript(({ dirBase64, sessionID }) => {
    localStorage.setItem(
      "settings.v3",
      JSON.stringify({
        general: {
          newLayoutDesigns: true,
          showFileTree: true,
          showNavigation: true,
          showSearch: true,
          showStatus: true,
          showTerminal: true,
        },
      }),
    )
    localStorage.setItem(
      "opencode.global.dat:layout",
      JSON.stringify({
        sessionTabs: {
          [`local\0${dirBase64}/${sessionID}`]: { all: ["rules"], active: "rules" },
        },
        review: { panelOpened: true },
      }),
    )
  }, { dirBase64: base64Encode(directory), sessionID })

  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  await expect(page.getByRole("heading", { name: "OpenRedou feature smoke" })).toBeVisible()

  await expect(page.getByLabel("Toggle terminal")).toBeVisible()
  await expect(page.getByLabel("Toggle file tree")).toBeVisible()

  await page.getByLabel("Toggle terminal").click()
  await expect(page.getByLabel("Toggle terminal")).toHaveAttribute("aria-expanded", "true")

  await expect(page.getByText("Global rules")).toBeVisible()
  const editors = page.locator("textarea")
  await expect(editors).toHaveCount(2)
  await editors.nth(1).fill("project smoke rule")
  await page.getByRole("button", { name: "Save" }).click()
  await expect.poll(() => requests.rules).toEqual({ global: "global smoke rule", project: "project smoke rule" })

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press("Control+Comma")
  await expect(page.getByText("OpenRedou v")).toBeVisible()
  await expect(page.getByText("Based on OpenCode v")).toBeVisible()

  await page.getByRole("tab", { name: "Archived" }).click()
  await expect(page.getByRole("heading", { name: "Closed projects" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Archived conversations" })).toBeVisible()

  await page.getByRole("tab", { name: "General" }).click()
  await expect(page.locator('[data-action="settings-show-navigation"]')).toBeVisible()
  await expect(page.locator('[data-action="settings-show-terminal"]')).toBeVisible()

  await page.getByRole("tab", { name: "Plugins" }).click()
  await expect(page.getByRole("heading", { name: "Configured plugins" })).toBeVisible()
  await page.locator('[role="tablist"]').last().getByRole("tab", { name: "Skills" }).click()
  await expect(page.getByRole("heading", { name: "Available skills" })).toBeVisible()
  await page.locator('[role="tablist"]').last().getByRole("tab", { name: "MCP" }).click()
  await expect(page.getByRole("heading", { name: "MCP servers" })).toBeVisible()
})

async function mockFeatureRoutes(page: Page, requests: { rules?: RulePayload; config?: unknown }) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url())
    if (url.port !== (process.env.PLAYWRIGHT_SERVER_PORT ?? "4096")) return route.fallback()
    if (url.pathname === "/rules") {
      if (route.request().method() === "GET") {
        return json(route, {
          global: { path: "C:/Users/OpenRedou/AGENTS.md", content: "global smoke rule" },
          project: { path: `${directory}/AGENTS.md`, content: "project original rule" },
        })
      }
      requests.rules = (await route.request().postDataJSON()) as RulePayload
      return json(route, {
        global: { path: "C:/Users/OpenRedou/AGENTS.md", content: requests.rules.global },
        project: { path: `${directory}/AGENTS.md`, content: requests.rules.project },
      })
    }
    if (url.pathname === "/skill") {
      return json(route, [
        {
          name: "openredou-skill",
          description: "Smoke skill",
          location: `${directory}/.codex/skills/openredou-skill`,
        },
      ])
    }
    if (url.pathname === "/global/config" && route.request().method() !== "GET") {
      requests.config = await route.request().postDataJSON()
      return json(route, requests.config)
    }
    return route.fallback()
  })
}

function json(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  })
}
