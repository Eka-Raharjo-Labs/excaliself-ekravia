// @vitest-environment node
// The 0019 migration creates instance_settings, and the helpers read and
// write it against a real database.
import { eq } from "drizzle-orm"
import { beforeAll, expect, test } from "vitest"
import { demoAdmin } from "@/db/demo-content"
import type { Db } from "@/db/index"
import { createPreviewDb } from "@/db/preview"
import { instanceSettings, users } from "@/db/schema"
import {
  getMembersPrivateEnabled,
  MEMBERS_PRIVATE_ENABLED_KEY,
  setMembersPrivateEnabled,
} from "./settings"

const member = { id: "member-s", email: "s@example.com", name: "S" }

let db: Db
beforeAll(async () => {
  db = await createPreviewDb()
  await db.insert(users).values(member)
}, 30_000)

test("the migration creates the instance_settings table", async () => {
  const rows = await db.select().from(instanceSettings)
  expect(rows).toEqual([])
})

test("the setting is off on a fresh instance", async () => {
  expect(await getMembersPrivateEnabled(db)).toBe(false)
})

test("an admin can turn it on and off", async () => {
  await setMembersPrivateEnabled(db, demoAdmin.id, true)
  expect(await getMembersPrivateEnabled(db)).toBe(true)

  await setMembersPrivateEnabled(db, demoAdmin.id, false)
  expect(await getMembersPrivateEnabled(db)).toBe(false)
})

test("a member cannot change the setting", async () => {
  await expect(setMembersPrivateEnabled(db, member.id, true)).rejects.toThrow(
    "Only admins can change instance settings",
  )
  expect(await getMembersPrivateEnabled(db)).toBe(false)
})

test("the write upserts instead of duplicating the row", async () => {
  await setMembersPrivateEnabled(db, demoAdmin.id, true)
  await setMembersPrivateEnabled(db, demoAdmin.id, true)

  const rows = await db
    .select()
    .from(instanceSettings)
    .where(eq(instanceSettings.key, MEMBERS_PRIVATE_ENABLED_KEY))
  expect(rows).toHaveLength(1)
  expect(rows[0]?.value).toBe("true")
})
