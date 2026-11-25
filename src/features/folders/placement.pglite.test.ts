// @vitest-environment node
// Putting rows into folders, as the sidebar and the MCP tools do.
import { eq } from "drizzle-orm"
import { beforeAll, expect, test } from "vitest"
import { demoAdmin } from "@/db/demo-content"
import type { Db } from "@/db/index"
import { createPreviewDb } from "@/db/preview"
import { drawings, folders, users } from "@/db/schema"
import { updateDrawingFields } from "@/features/drawings/update"
import { insertFolder } from "./create"

const member = { id: "member-b", email: "b@example.com", name: "B" }

let db: Db
beforeAll(async () => {
  db = await createPreviewDb()
  await db.insert(users).values(member)
  await db.insert(folders).values([
    { id: "team-folder", name: "Team", space: "team", createdBy: member.id },
    {
      id: "admin-private",
      name: "Admin's",
      space: "private",
      createdBy: demoAdmin.id,
    },
    {
      id: "member-private",
      name: "Mine",
      space: "private",
      createdBy: member.id,
    },
  ])
  await db.insert(drawings).values([
    {
      id: "mine",
      name: "Mine",
      space: "private",
      createdBy: member.id,
    },
    {
      id: "team-drawing",
      name: "Team drawing",
      space: "team",
      createdBy: member.id,
    },
  ])
}, 30_000)

const folderOf = async (id: string) =>
  (
    await db
      .select({ folderId: drawings.folderId })
      .from(drawings)
      .where(eq(drawings.id, id))
  )[0]?.folderId

test("a folder made inside a Team folder is in Team", async () => {
  const folder = await insertFolder(db, member.id, {
    name: "Sub",
    parentId: "team-folder",
    space: "private",
  })

  expect(folder.space).toBe("team")
  expect(folder.parentId).toBe("team-folder")
}, 30_000)

test("a Private drawing can't move into a Team folder", async () => {
  await expect(
    updateDrawingFields(db, member.id, "mine", { folderId: "team-folder" }),
  ).rejects.toThrow("Drawing not found")
  expect(await folderOf("mine")).toBeNull()
}, 30_000)

test("another member's Private folder is not a target", async () => {
  await expect(
    insertFolder(db, member.id, {
      name: "Sneaky",
      parentId: "admin-private",
      space: "private",
    }),
  ).rejects.toThrow("Folder not found")
  await expect(
    updateDrawingFields(db, member.id, "mine", { folderId: "admin-private" }),
  ).rejects.toThrow("Folder not found")
}, 30_000)

test("a drawing moves into its own Space's folder and back to the top", async () => {
  const folder = await insertFolder(db, member.id, {
    name: "Team too",
    parentId: null,
    space: "team",
  })

  await updateDrawingFields(db, member.id, "team-drawing", {
    folderId: folder.id,
  })
  expect(await folderOf("team-drawing")).toBe(folder.id)

  await updateDrawingFields(db, member.id, "team-drawing", { folderId: null })
  expect(await folderOf("team-drawing")).toBeNull()
}, 30_000)

test("a member's top-level Private folder lands in Team", async () => {
  const folder = await insertFolder(db, member.id, {
    name: "Member private",
    parentId: null,
    space: "private",
  })

  expect(folder.space).toBe("team")
}, 30_000)

test("an admin's top-level Private folder stays Private", async () => {
  const folder = await insertFolder(db, demoAdmin.id, {
    name: "Admin private",
    parentId: null,
    space: "private",
  })

  expect(folder.space).toBe("private")
}, 30_000)

test("a member cannot create a folder inside their own Private folder", async () => {
  await expect(
    insertFolder(db, member.id, {
      name: "Sneaky",
      parentId: "member-private",
      space: "private",
    }),
  ).rejects.toThrow("Cannot create in a Private folder")
}, 30_000)
