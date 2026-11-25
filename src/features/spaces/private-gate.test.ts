import { expect, test } from "vitest"
import { instanceSettings, users } from "@/db/schema"
import { isPrivateAllowed } from "./private-gate"

function fakeDb(role: "admin" | "user" | undefined, setting: boolean) {
  return {
    select: () => ({
      from: (table: unknown) => {
        if (table === users)
          return {
            where: () => Promise.resolve(role ? [{ role }] : []),
          }
        if (table === instanceSettings)
          return {
            where: () => Promise.resolve(setting ? [{ value: "true" }] : []),
          }
        throw new Error("unexpected table")
      },
    }),
  } as unknown as Parameters<typeof isPrivateAllowed>[0]
}

test("an admin may create in Private with the setting off", async () => {
  expect(await isPrivateAllowed(fakeDb("admin", false), "admin-1")).toBe(true)
})

test("an admin may create in Private with the setting on", async () => {
  expect(await isPrivateAllowed(fakeDb("admin", true), "admin-1")).toBe(true)
})

test("a member may not create in Private with the setting off", async () => {
  expect(await isPrivateAllowed(fakeDb("user", false), "member-1")).toBe(false)
})

test("a member may create in Private with the setting on", async () => {
  expect(await isPrivateAllowed(fakeDb("user", true), "member-1")).toBe(true)
})

test("an unknown user may not create in Private", async () => {
  expect(await isPrivateAllowed(fakeDb(undefined, true), "nobody")).toBe(false)
})
