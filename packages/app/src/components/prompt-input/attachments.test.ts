import { describe, expect, test } from "bun:test"
import { promptDropPayload } from "./drop"
import { attachmentMime } from "./files"
import { pasteMode } from "./paste"

function dropData(input: { files?: File[]; plainText?: string }) {
  return {
    files: (input.files ?? []) as unknown as FileList,
    getData: (type: string) => (type === "text/plain" ? (input.plainText ?? "") : ""),
  } satisfies Pick<DataTransfer, "files" | "getData">
}

describe("attachmentMime", () => {
  test("keeps PDFs when the browser reports the mime", async () => {
    const file = new File(["%PDF-1.7"], "guide.pdf", { type: "application/pdf" })
    expect(await attachmentMime(file)).toBe("application/pdf")
  })

  test("normalizes structured text types to text/plain", async () => {
    const file = new File(['{"ok":true}\n'], "data.json", { type: "application/json" })
    expect(await attachmentMime(file)).toBe("text/plain")
  })

  test("accepts text files even with a misleading browser mime", async () => {
    const file = new File(["export const x = 1\n"], "main.ts", { type: "video/mp2t" })
    expect(await attachmentMime(file)).toBe("text/plain")
  })

  test("accepts dragged images with a misleading browser mime", async () => {
    const file = new File([Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)], "image.png", {
      type: "application/x-unknown",
    })
    expect(await attachmentMime(file)).toBe("image/png")
  })

  test("accepts dragged PDFs with a misleading browser mime", async () => {
    const file = new File(["%PDF-1.7"], "guide.pdf", { type: "application/x-unknown" })
    expect(await attachmentMime(file)).toBe("application/pdf")
  })

  test("rejects binary files", async () => {
    const file = new File([Uint8Array.of(0, 255, 1, 2)], "blob.bin", { type: "application/octet-stream" })
    expect(await attachmentMime(file)).toBeUndefined()
  })
})

describe("promptDropPayload", () => {
  test("prefers real dropped files over file URLs", () => {
    const file = new File(["hello"], "note.txt", { type: "text/plain" })
    expect(promptDropPayload(dropData({ files: [file], plainText: "file:///C:/tmp/note.txt" }))).toEqual({
      type: "attachments",
      files: [file],
    })
  })

  test("keeps internal file tree drops as mentions", () => {
    expect(promptDropPayload(dropData({ plainText: "file:src/main.ts" }))).toEqual({
      type: "mention",
      path: "src/main.ts",
    })
  })

  test("ignores external file URLs without dropped file data", () => {
    expect(promptDropPayload(dropData({ plainText: "file:///C:/tmp/note.txt" }))).toEqual({ type: "none" })
  })
})

describe("pasteMode", () => {
  test("uses native paste for short single-line text", () => {
    expect(pasteMode("hello world")).toBe("native")
  })

  test("uses manual paste for multiline text", () => {
    expect(
      pasteMode(`{
  "ok": true
}`),
    ).toBe("manual")
    expect(pasteMode("a\r\nb")).toBe("manual")
  })

  test("uses manual paste for large text", () => {
    expect(pasteMode("x".repeat(8000))).toBe("manual")
  })
})
