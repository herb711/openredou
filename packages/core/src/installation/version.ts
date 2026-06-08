import rootPkg from "../../../../package.json"

declare global {
  const OPENCODE_VERSION: string
  const OPENCODE_CHANNEL: string
  const OPENCODE_UPSTREAM_OPENCODE_VERSION: string
}

const fallbackVersion = rootPkg.version ?? "local"
const fallbackUpstreamOpenCodeVersion = rootPkg.upstream?.opencodeVersion ?? "local"

export const InstallationVersion = typeof OPENCODE_VERSION === "string" ? OPENCODE_VERSION : fallbackVersion
export const InstallationChannel = typeof OPENCODE_CHANNEL === "string" ? OPENCODE_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
export const UpstreamOpenCodeVersion =
  typeof OPENCODE_UPSTREAM_OPENCODE_VERSION === "string"
    ? OPENCODE_UPSTREAM_OPENCODE_VERSION
    : fallbackUpstreamOpenCodeVersion

export function getAppVersion(version = InstallationVersion) {
  return version
}

export function getUpstreamOpenCodeVersion() {
  return UpstreamOpenCodeVersion
}

export function getFullVersionLabel(version = InstallationVersion, upstreamOpenCodeVersion = UpstreamOpenCodeVersion) {
  return `OpenRedou v${getAppVersion(version)} · OpenCode Core ${upstreamOpenCodeVersion}`
}
