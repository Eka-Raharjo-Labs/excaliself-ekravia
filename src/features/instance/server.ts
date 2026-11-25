"use server"

import { createServerFn } from "@tanstack/react-start"
import { count, isNull, sql } from "drizzle-orm"
import z from "zod"
import { db } from "@/db"
import { drawingFiles, drawings, users } from "@/db/schema"
import { adminMiddleware } from "@/middleware/admin"
import packageJson from "../../../package.json"
import {
  getMembersPrivateEnabled,
  setMembersPrivateEnabled as writeMembersPrivateEnabled,
} from "./settings"

export const getInstanceStats = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const [userCount] = await db.select({ value: count() }).from(users)
    // Drawing count matches what users see (trash excluded); storage is the
    // physical bytes held, trash included — scene JSON and the embedded
    // images in drawing_files.
    const [drawingCount] = await db
      .select({ value: count() })
      .from(drawings)
      .where(isNull(drawings.deletedAt))
    const [sceneBytes] = await db
      .select({
        value: sql`coalesce(sum(octet_length(${drawings.data})), 0)`.mapWith(
          Number,
        ),
      })
      .from(drawings)
    const [fileBytes] = await db
      .select({
        value:
          sql`coalesce(sum(octet_length(${drawingFiles.bytes})), 0)`.mapWith(
            Number,
          ),
      })
      .from(drawingFiles)

    return {
      version: packageJson.version,
      userCount: userCount.value,
      drawingCount: drawingCount.value,
      storageBytes: sceneBytes.value + fileBytes.value,
    }
  })

// The instance's one admin setting: whether members may use Private.
// Missing row means off. Guarded twice — adminMiddleware on the endpoint,
// and the helper's own role check on the write.
export const getInstanceSettings = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => ({
    membersPrivateEnabled: await getMembersPrivateEnabled(db),
  }))

export const setMembersPrivateEnabled = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ enabled: z.boolean() }))
  .handler(async ({ data, context }) => {
    await writeMembersPrivateEnabled(db, context.session.user.id, data.enabled)
  })
