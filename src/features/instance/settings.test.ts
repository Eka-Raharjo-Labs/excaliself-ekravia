import { expect, test } from "vitest"
import { instanceSettings, users } from "@/db/schema"
import {
  getMembersPrivateEnabled,
  MEMBERS_PRIVATE_ENABLED_KEY,
  setMembersPrivateEnabled,
} from "./settings"

type Role = "admin" | "user" | undefined

function fakeDb(role: Role, settingValue: string | undefined) {
  const inserts: unknown[] = []
  return {
    db: {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (table === users) return Promise.resolve(role ? [{ role }] : [])
            if (table === instanceSettings)
              return Promise.resolve(
                settingValue === undefined ? [] : [{ value: settingValue }],
              )
            throw new Error("unexpected table")
          },
        }),
      }),
      insert: () => ({
        values: (row: unknown) => ({
          onConflictDoUpdate: (opts: unknown) => {
            inserts.push({ row, opts })
            return Promise.resolve()
          },
        }),
      }),
    } as unknown as Parameters<typeof setMembersPrivateEnabled>[0],
    inserts,
  }
}

test("a missing row means the setting is off", async () => {
  const { db } = fakeDb("admin", undefined)
  expect(await getMembersPrivateEnabled(db)).toBe(false)
})

test('the setting reads exactly "true"', async () => {
  const { db } = fakeDb("admin", "true")
  expect(await getMembersPrivateEnabled(db)).toBe(true)
})

test('"false" and anything else read as off', async () => {
  expect(await getMembersPrivateEnabled(fakeDb("admin", "false").db)).toBe(
    false,
  )
  expect(await getMembersPrivateEnabled(fakeDb("admin", "yes").db)).toBe(false)
})

test("an admin's write upserts the row", async () => {
  const { db, inserts } = fakeDb("admin", undefined)
  await setMembersPrivateEnabled(db, "admin-1", true)

  expect(inserts).toHaveLength(1)
  expect(inserts[0]).toMatchObject({
    row: { key: MEMBERS_PRIVATE_ENABLED_KEY, value: "true" },
  })
})

test("a member cannot change the setting", async () => {
  const { db, inserts } = fakeDb("user", "false")
  await expect(setMembersPrivateEnabled(db, "member-1", true)).rejects.toThrow(
    "Only admins can change instance settings",
  )
  expect(inserts).toHaveLength(0)
})

test("an unknown user cannot change the setting", async () => {
  const { db, inserts } = fakeDb(undefined, "false")
  await expect(setMembersPrivateEnabled(db, "nobody", true)).rejects.toThrow(
    "Only admins can change instance settings",
  )
  expect(inserts).toHaveLength(0)
})
