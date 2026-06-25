import { $ } from "bun"
import semver from "semver"
import path from "path"

const rootPkgPath = path.resolve(import.meta.dir, "../../../package.json")
const rootPkg = (await Bun.file(rootPkgPath).json()) as {
  packageManager?: string
  version?: string
  upstream?: {
    opencodeVersion?: string
  }
}
const expectedBunVersion = rootPkg.packageManager?.split("@")[1]
const productVersion = rootPkg.version
const upstreamOpenCodeVersion = rootPkg.upstream?.opencodeVersion

if (!expectedBunVersion) {
  throw new Error("packageManager field not found in root package.json")
}

if (!productVersion) {
  throw new Error("version field not found in root package.json")
}

if (!upstreamOpenCodeVersion) {
  throw new Error("upstream.opencodeVersion field not found in root package.json")
}

// relax version requirement
const expectedBunVersionRange = `^${expectedBunVersion}`

if (!semver.satisfies(process.versions.bun, expectedBunVersionRange)) {
  throw new Error(`This script requires bun@${expectedBunVersionRange}, but you are using bun@${process.versions.bun}`)
}

const env = {
  OPENCODE_CHANNEL: process.env["OPENCODE_CHANNEL"],
  OPENCODE_BUMP: process.env["OPENCODE_BUMP"],
  OPENCODE_VERSION: process.env["OPENCODE_VERSION"],
  OPENCODE_RELEASE: process.env["OPENCODE_RELEASE"],
}
const CHANNEL = await (async () => {
  if (env.OPENCODE_CHANNEL) return env.OPENCODE_CHANNEL
  if (env.OPENCODE_BUMP) return "latest"
  if (env.OPENCODE_VERSION && !env.OPENCODE_VERSION.startsWith("0.0.0-")) return "latest"
  return await $`git branch --show-current`.text().then((x) => x.trim())
})()
const IS_PREVIEW = !["latest", "prod", "main"].includes(CHANNEL)

const VERSION = await (async () => {
  if (env.OPENCODE_VERSION) return env.OPENCODE_VERSION
  if (IS_PREVIEW) return `0.0.0-${CHANNEL}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`
  const t = env.OPENCODE_BUMP?.toLowerCase()
  if (!t) return productVersion
  const next = semver.inc(productVersion, t === "major" || t === "minor" ? t : "patch")
  if (!next) throw new Error(`Invalid root package.json version: ${productVersion}`)
  return next
})()

const bot = ["actions-user", "opencode", "opencode-agent[bot]"]
const teamPath = path.resolve(import.meta.dir, "../../../.github/TEAM_MEMBERS")
const teamFile = Bun.file(teamPath)
const team = [
  ...((await teamFile.exists())
    ? await teamFile
        .text()
        .then((x) => x.split(/\r?\n/).map((x) => x.trim()))
        .then((x) => x.filter((x) => x && !x.startsWith("#")))
    : []),
  ...bot,
]

export const Script = {
  get channel() {
    return CHANNEL
  },
  get version() {
    return VERSION
  },
  get upstreamOpenCodeVersion() {
    return upstreamOpenCodeVersion
  },
  get preview() {
    return IS_PREVIEW
  },
  get release(): boolean {
    return !!env.OPENCODE_RELEASE
  },
  get team() {
    return team
  },
}
console.log(`opencode script`, JSON.stringify(Script, null, 2))
