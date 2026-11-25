// @vitest-environment node
// Members can't create in Private: top-level Private creates land in Team,
// and creating inside a Private folder is rejected. Admins are unchanged.
import { eq } from "drizzle-orm"
import { beforeAll, expect, test } from "vitest"
import { demoAdmin } from "@/db/demo-content"
import type { Db } from "@/db/index"
import { createPreviewDb } from "@/db/preview"
import { drawings, folders, users } from "@/db/schema"
import { setMembersPrivateEnabled } from "@/features/instance/settings"
import { insertDrawing } from "./create"

const member = { id: "member-c", email: "c@example.com", name: "C" }

let db: Db
beforeAll(async () => {
  db = await createPreviewDb()
  await db.insert(users).values(member)
  await db.insert(folders).values([
    {
      id: "member-private-folder",
      name: "Mine",
      space: "private",
      createdBy: member.id,
    },
    {
      id: "team-folder",
      name: "Team",
      space: "team",
      createdBy: demoAdmin.id,
    },
  ])
}, 30_000)

const row = async (id: string) =>
  (await db.select().from(drawings).where(eq(drawings.id, id)))[0]

test("a member's top-level Private create lands in Team", async () => {
  const created = await insertDrawing(db, member.id, {
    name: "Member private",
    folderId: null,
    space: "private",
    elements: [],
  })

  expect(created.space).toBe("team")
  expect(await row(created.id)).toMatchObject({
    space: "team",
    createdBy: member.id,
  })
})

test("an admin's top-level Private create stays Private", async () => {
  const created = await insertDrawing(db, demoAdmin.id, {
    name: "Admin private",
    folderId: null,
    space: "private",
    elements: [],
  })

  expect(created.space).toBe("private")
  expect(await row(created.id)).toMatchObject({ space: "private" })
})

test("a member cannot create inside their own Private folder", async () => {
  await expect(
    insertDrawing(db, member.id, {
      name: "Sneaky",
      folderId: "member-private-folder",
      space: "private",
      elements: [],
    }),
  ).rejects.toThrow("Cannot create in a Private folder")
})

test("a member's create inside a Team folder lands in Team", async () => {
  const created = await insertDrawing(db, member.id, {
    name: "Member team",
    folderId: "team-folder",
    space: "private",
    elements: [],
  })

  expect(created.space).toBe("team")
  expect(await row(created.id)).toMatchObject({
    folderId: "team-folder",
    space: "team",
  })
})

test("a member's top-level Private create stays Private while the setting is on", async () => {
  await setMembersPrivateEnabled(db, demoAdmin.id, true)
  try {
    const created = await insertDrawing(db, member.id, {
      name: "Member private on",
      folderId: null,
      space: "private",
      elements: [],
    })

    expect(created.space).toBe("private")
    expect(await row(created.id)).toMatchObject({ space: "private" })
  } finally {
    await setMembersPrivateEnabled(db, demoAdmin.id, false)
  }
})
