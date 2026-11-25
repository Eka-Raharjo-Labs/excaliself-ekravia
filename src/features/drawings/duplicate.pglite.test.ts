// @vitest-environment node
import { eq } from "drizzle-orm"
import { beforeAll, expect, test } from "vitest"
import { demoAdmin } from "@/db/demo-content"
import type { Db } from "@/db/index"
import { createPreviewDb } from "@/db/preview"
import { drawingFiles, drawings, folders, users } from "@/db/schema"
import { copyDrawing, copyName } from "./duplicate"
import { MAX_NAME_LENGTH } from "./list-columns"

const member = { id: "member-d", email: "d@example.com", name: "D" }

let db: Db
beforeAll(async () => {
  db = await createPreviewDb()
  await db.insert(users).values(member)
  await db.insert(folders).values([
    {
      id: "team-folder",
      name: "Folder",
      space: "team",
      createdBy: demoAdmin.id,
    },
    {
      id: "member-private-folder",
      name: "Mine",
      space: "private",
      createdBy: member.id,
    },
  ])
  await db.insert(drawings).values([
    {
      id: "source",
      name: "Plan",
      data: JSON.stringify({
        elements: [{ id: "a", type: "text", text: "stored" }],
        appState: { viewBackgroundColor: "#fff" },
      }),
      searchText: "stored",
      folderId: "team-folder",
      space: "team",
      createdBy: demoAdmin.id,
    },
    {
      id: "admins-private",
      name: "Private",
      space: "private",
      createdBy: demoAdmin.id,
    },
    {
      id: "mine-private",
      name: "Mine",
      data: JSON.stringify({
        elements: [{ id: "a", type: "text", text: "mine" }],
        appState: { viewBackgroundColor: "#fff" },
      }),
      searchText: "mine",
      folderId: "member-private-folder",
      space: "private",
      createdBy: member.id,
    },
  ])
  await db.insert(drawingFiles).values({
    id: "file-row",
    drawingId: "source",
    fileId: "img",
    mimeType: "image/png",
    bytes: Buffer.from([1, 2, 3]),
  })
}, 30_000)

const row = async (id: string) =>
  (await db.select().from(drawings).where(eq(drawings.id, id)))[0]

const files = (drawingId: string) =>
  db
    .select({ fileId: drawingFiles.fileId, bytes: drawingFiles.bytes })
    .from(drawingFiles)
    .where(eq(drawingFiles.drawingId, drawingId))

test("a copy lands next to the original, with its images, owned by the caller", async () => {
  const copy = await copyDrawing(db, member.id, "source", null)

  expect(copy.name).toBe("Plan (copy)")
  const stored = await row(copy.id)
  const source = await row("source")
  expect(stored).toMatchObject({
    name: "Plan (copy)",
    data: source?.data,
    searchText: "stored",
    folderId: "team-folder",
    space: "team",
    createdBy: member.id,
  })
  expect(await files(copy.id)).toEqual(await files("source"))
}, 30_000)

test("a live Room's scene replaces the stored elements, keeping appState", async () => {
  const live = [{ id: "b", type: "text", text: "live" }]
  const copy = await copyDrawing(db, member.id, "source", live)

  const stored = await row(copy.id)
  expect(JSON.parse(stored?.data ?? "")).toEqual({
    elements: live,
    appState: { viewBackgroundColor: "#fff" },
  })
  expect(stored?.searchText).toBe("live")
}, 30_000)

test("another member's private drawing can't be copied", async () => {
  await expect(
    copyDrawing(db, member.id, "admins-private", null),
  ).rejects.toThrow("Drawing not found")
}, 30_000)

test("the copy's name still fits the limit", () => {
  const name = copyName("x".repeat(MAX_NAME_LENGTH))
  expect(name).toHaveLength(MAX_NAME_LENGTH)
  expect(name.endsWith(" (copy)")).toBe(true)
})

test("a member's copy of their Private drawing lands in the Team root", async () => {
  const copy = await copyDrawing(db, member.id, "mine-private", null)

  expect(copy.name).toBe("Mine (copy)")
  const stored = await row(copy.id)
  expect(stored).toMatchObject({
    folderId: null,
    space: "team",
    createdBy: member.id,
  })
}, 30_000)

test("an admin's copy of a Private drawing stays next to it", async () => {
  const copy = await copyDrawing(db, demoAdmin.id, "admins-private", null)

  expect(copy.name).toBe("Private (copy)")
  const stored = await row(copy.id)
  expect(stored).toMatchObject({
    folderId: null,
    space: "private",
    createdBy: demoAdmin.id,
  })
}, 30_000)
