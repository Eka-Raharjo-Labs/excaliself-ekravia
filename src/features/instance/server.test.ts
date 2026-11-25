// @vitest-environment node
// Server fns without the Start compiler: each one is its validator + handler,
// called as the member in `as`. The admin middleware is mocked away, so the
// rejection here comes from the helper's own role check; the middleware
// guards the same endpoint in production.
import { beforeAll, expect, test, vi } from "vitest"
import { users } from "@/db/schema"

const as = vi.hoisted(() => ({ userId: "admin" }))
vi.mock("@tanstack/react-start", () => {
  type Chain = {
    middleware: () => Chain
    validator: (schema: { parse(data: unknown): unknown }) => Chain
    handler: (
      fn: (opts: { data: unknown; context: unknown }) => unknown,
    ) => (opts?: { data: unknown }) => unknown
  }
  const chain = (schema?: { parse(data: unknown): unknown }): Chain => ({
    middleware: () => chain(schema),
    validator: (next) => chain(next),
    handler: (fn) => async (opts) =>
      fn({
        data: schema ? schema.parse(opts?.data) : opts?.data,
        context: { session: { user: { id: as.userId } } },
      }),
  })
  return { createServerFn: () => chain() }
})
vi.mock("@/middleware/admin", () => ({ adminMiddleware: {} }))
vi.mock("@/db", async () => {
  const { createPreviewDb } = await import("@/db/preview")
  return { db: await createPreviewDb() }
})

const { db } = await import("@/db")
const { demoAdmin } = await import("@/db/demo-content")
const { getInstanceSettings, setMembersPrivateEnabled } = await import(
  "./server"
)

const member = { id: "member-i", email: "i@example.com", name: "I" }

beforeAll(async () => {
  await db.insert(users).values(member)
}, 30_000)

const set = (enabled: boolean, userId = as.userId) => {
  as.userId = userId
  return setMembersPrivateEnabled({ data: { enabled } })
}

test("the setting is off on a fresh instance", async () => {
  expect(await getInstanceSettings()).toEqual({
    membersPrivateEnabled: false,
  })
})

test("an admin can turn it on and off", async () => {
  await set(true, demoAdmin.id)
  expect(await getInstanceSettings()).toEqual({ membersPrivateEnabled: true })

  await set(false, demoAdmin.id)
  expect(await getInstanceSettings()).toEqual({
    membersPrivateEnabled: false,
  })
})

test("a member cannot change the setting", async () => {
  await expect(set(true, member.id)).rejects.toThrow(
    "Only admins can change instance settings",
  )
  expect(await getInstanceSettings()).toEqual({
    membersPrivateEnabled: false,
  })
})
