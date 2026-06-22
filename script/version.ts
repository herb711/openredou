#!/usr/bin/env bun

import { Script } from "@opencode-ai/script"
import { $ } from "bun"

const repo = process.env.GH_REPO
if (!repo) throw new Error("GH_REPO is required")

const output = [`version=${Script.version}`]
const sha = process.env.GITHUB_SHA ?? (await $`git rev-parse HEAD`.text()).trim()
const releaseTitle = `OpenRedou v${Script.version}`
const releaseSummary = `OpenRedou ${Script.version} based on OpenCode ${Script.upstreamOpenCodeVersion}.`

type Release = {
  tagName: string
  databaseId: number
}

async function ensureRelease(): Promise<Release> {
  const tag = `v${Script.version}`
  const existing = await $`gh release view ${tag} --json tagName,databaseId --repo ${repo}`.quiet().nothrow()

  if (existing.exitCode === 0) {
    console.log(`Reusing existing release ${tag}`)
    return JSON.parse(existing.stdout.toString()) as Release
  }

  const dir = process.env.RUNNER_TEMP ?? "/tmp"
  const notesFile = `${dir}/opencode-release-notes.txt`
  await Bun.write(notesFile, releaseSummary)
  await $`gh release create ${tag} -d --target ${sha} --title ${releaseTitle} --notes-file ${notesFile} --repo ${repo}`
  return (await $`gh release view ${tag} --json tagName,databaseId --repo ${repo}`.json()) as Release
}

if (!Script.preview) {
  const release = await ensureRelease()
  output.push(`release=${release.databaseId}`)
  output.push(`tag=${release.tagName}`)
} else if (Script.channel === "beta") {
  const release = await ensureRelease()
  output.push(`release=${release.databaseId}`)
  output.push(`tag=${release.tagName}`)
}

output.push(`repo=${repo}`)

if (process.env.GITHUB_OUTPUT) {
  await Bun.write(process.env.GITHUB_OUTPUT, output.join("\n"))
}

process.exit(0)
