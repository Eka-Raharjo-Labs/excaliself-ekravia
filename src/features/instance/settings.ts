// Instance-wide settings, one row per key in instance_settings. Values are
// plain strings; "true"/"false" for booleans. A missing row means the
// default (off), so a fresh instance needs no seed row. Kept out of
// server files so tests can drive the helpers with a fake db.

import { eq } from "drizzle-orm"
import type { Db } from "@/db"
import { instanceSettings, users } from "@/db/schema"

/** Whether members may create in Private. Admins ignore this setting. */
export const MEMBERS_PRIVATE_ENABLED_KEY = "members_private_enabled"

/** False unless the row exists and reads exactly "true". */
export async function getMembersPrivateEnabled(
  db: Pick<Db, "select">,
): Promise<boolean> {
  const [row] = await db
    .select({ value: instanceSettings.value })
    .from(instanceSettings)
    .where(eq(instanceSettings.key, MEMBERS_PRIVATE_ENABLED_KEY))
  return row?.value === "true"
}

/**
 * Only admins may change the setting — the admin middleware guards the
 * endpoint, and this check guards the write itself, so a forged request
 * can't flip it either.
 */
export async function setMembersPrivateEnabled(
  db: Pick<Db, "select" | "insert">,
  userId: string,
  enabled: boolean,
): Promise<void> {
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
  if (user?.role !== "admin") {
    throw new Error("Only admins can change instance settings")
  }
  const value = enabled ? "true" : "false"
  await db
    .insert(instanceSettings)
    .values({ key: MEMBERS_PRIVATE_ENABLED_KEY, value })
    .onConflictDoUpdate({
      target: instanceSettings.key,
      set: { value },
    })
}
