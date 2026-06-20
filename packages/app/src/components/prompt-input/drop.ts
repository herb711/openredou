type DropData = Pick<DataTransfer, "files" | "getData">

export function promptDropPayload(dataTransfer: DropData | null | undefined) {
  const files = dataTransfer?.files ? Array.from(dataTransfer.files) : []
  if (files.length > 0) return { type: "attachments" as const, files }

  const plainText = dataTransfer?.getData("text/plain")
  const filePrefix = "file:"
  if (plainText?.startsWith(filePrefix) && !plainText.startsWith("file://")) {
    return { type: "mention" as const, path: plainText.slice(filePrefix.length) }
  }

  return { type: "none" as const }
}
