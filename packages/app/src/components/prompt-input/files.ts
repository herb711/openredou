import { ACCEPTED_FILE_TYPES, ACCEPTED_IMAGE_TYPES } from "@/constants/file-picker"

export { ACCEPTED_FILE_TYPES }

const IMAGE_MIMES = new Set(ACCEPTED_IMAGE_TYPES)
const IMAGE_EXTS = new Map([
  ["gif", "image/gif"],
  ["jpeg", "image/jpeg"],
  ["jpg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
])
const TEXT_MIMES = new Set([
  "application/json",
  "application/ld+json",
  "application/toml",
  "application/x-toml",
  "application/x-yaml",
  "application/xml",
  "application/yaml",
])

const SAMPLE = 4096
const PDF_HEADER = new TextEncoder().encode("%PDF-")
const GIF87A_HEADER = new TextEncoder().encode("GIF87a")
const GIF89A_HEADER = new TextEncoder().encode("GIF89a")
const RIFF_HEADER = new TextEncoder().encode("RIFF")
const WEBP_HEADER = new TextEncoder().encode("WEBP")
const PNG_HEADER = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)

function kind(type: string) {
  return type.split(";", 1)[0]?.trim().toLowerCase() ?? ""
}

function ext(name: string) {
  const idx = name.lastIndexOf(".")
  if (idx === -1) return ""
  return name.slice(idx + 1).toLowerCase()
}

function textMime(type: string) {
  if (!type) return false
  if (type.startsWith("text/")) return true
  if (TEXT_MIMES.has(type)) return true
  if (type.endsWith("+json")) return true
  return type.endsWith("+xml")
}

function textBytes(bytes: Uint8Array) {
  if (bytes.length === 0) return true
  let count = 0
  for (const byte of bytes) {
    if (byte === 0) return false
    if (byte < 9 || (byte > 13 && byte < 32)) count += 1
  }
  return count / bytes.length <= 0.3
}

function startsWith(bytes: Uint8Array, prefix: Uint8Array) {
  if (bytes.length < prefix.length) return false
  return prefix.every((byte, index) => bytes[index] === byte)
}

function binaryMime(suffix: string, bytes: Uint8Array) {
  if (suffix === "pdf" && startsWith(bytes, PDF_HEADER)) return "application/pdf"
  if (suffix === "png" && startsWith(bytes, PNG_HEADER)) return "image/png"
  if ((suffix === "jpg" || suffix === "jpeg") && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg"
  }
  if (suffix === "gif" && (startsWith(bytes, GIF87A_HEADER) || startsWith(bytes, GIF89A_HEADER))) return "image/gif"
  if (suffix === "webp" && startsWith(bytes, RIFF_HEADER) && startsWith(bytes.slice(8), WEBP_HEADER)) return "image/webp"
}

export async function attachmentMime(file: File) {
  const type = kind(file.type)
  if (IMAGE_MIMES.has(type)) return type
  if (type === "application/pdf") return type

  const suffix = ext(file.name)
  const fallback = IMAGE_EXTS.get(suffix) ?? (suffix === "pdf" ? "application/pdf" : undefined)
  if ((!type || type === "application/octet-stream") && fallback) return fallback

  if (textMime(type)) return "text/plain"
  const bytes = new Uint8Array(await file.slice(0, SAMPLE).arrayBuffer())
  const binary = binaryMime(suffix, bytes)
  if (binary) return binary
  if (!textBytes(bytes)) return
  return "text/plain"
}
