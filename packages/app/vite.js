import { copyFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs"
import solidPlugin from "vite-plugin-solid"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath } from "url"
import { join, resolve } from "node:path"

const theme = fileURLToPath(new URL("./public/oc-theme-preload.js", import.meta.url))
const favicon = fileURLToPath(new URL("../ui/src/assets/favicon", import.meta.url))
let faviconOutDir = ""

const channel = (() => {
  const raw = process.env.OPENCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  if (process.env.OPENCODE_CHANNEL === "latest") return "prod"
  return "dev"
})()

/**
 * @type {import("vite").PluginOption}
 */
export default [
  {
    name: "opencode-desktop:config",
    config() {
      return {
        resolve: {
          alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
          },
        },
        define: {
          "import.meta.env.VITE_OPENCODE_CHANNEL": JSON.stringify(channel),
        },
        worker: {
          format: "es",
        },
      }
    },
  },
  {
    name: "opencode-desktop:theme-preload",
    transformIndexHtml(html) {
      return html.replace(
        '<script id="oc-theme-preload-script" src="/oc-theme-preload.js"></script>',
        `<script id="oc-theme-preload-script">${readFileSync(theme, "utf8")}</script>`,
      )
    },
  },
  {
    name: "opencode-desktop:favicon-assets",
    configResolved(config) {
      faviconOutDir = resolve(config.root, config.build.outDir)
    },
    writeBundle() {
      if (!faviconOutDir) return
      mkdirSync(faviconOutDir, { recursive: true })
      for (const file of readdirSync(favicon)) {
        copyFileSync(join(favicon, file), join(faviconOutDir, file))
      }
    },
  },
  tailwindcss(),
  solidPlugin(),
]
