// Whether a member may create in Private. A server gate only: the UI never
// offers Private to members while the setting is off, but the engines
// enforce it regardless, so an MCP client or a forged request can't get
// around it. Kept out of server files so tests can drive it with a fake db.

import { eq } from "drizzle-orm"
import type { Db } from "@/db"
import { type Space, users } from "@/db/schema"
import type { Tx } from "@/features/folders/tree-lock"
import { getMembersPrivateEnabled } from "@/features/instance/settings"

/**
 * Admins always; members only while the instance setting is on. A missing
 * setting row means off, so a fresh instance keeps Private admin-only.
 */
export async function isPrivateAllowed(
  db: Pick<Db, "select">,
  userId: string,
): Promise<boolean> {
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
  if (user?.role === "admin") return true
  if (!user) return false
  return getMembersPrivateEnabled(db)
}

/**
 * The space a create lands in. A member's top-level Private create moves to
 * Team; placing into a Private folder is rejected instead, so no new content
 * lands in Private by accident. Admins are unchanged. `folderId` is the
 * parent the item goes into, or null for a top-level create.
 */
export async function gateCreateSpace(
  tx: Tx,
  userId: string,
  space: Space,
  folderId: string | null,
): Promise<Space> {
  if (space !== "private") return space
  if (await isPrivateAllowed(tx, userId)) return space
  if (folderId) throw new Error("Cannot create in a Private folder")
  return "team"
}
