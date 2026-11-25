import { useQuery } from "@tanstack/react-query"
import { useSearch } from "@tanstack/react-router"
import type { Space } from "@/db/schema"
import { currentUserQueryOptions } from "@/features/account/queries"

/** Search params of the browse surfaces, Home and All drawings. */
export type SpaceSearch = { space?: Space }

export const validateSpaceSearch = (
  search: Record<string, unknown>,
): SpaceSearch =>
  search.space === "team" || search.space === "private"
    ? { space: search.space }
    : {}

/**
 * The space the member is browsing: the `space` param, Private by default.
 * Null while Team is hidden, which means "no space filter". Members browse
 * Team unless the admin setting lets them use Private.
 */
export function useBrowsedSpace(): Space | null {
  const { data: user } = useQuery(currentUserQueryOptions())
  const { space = "private" } = useSearch({ strict: false })
  if (!user?.teamEnabled) return null
  if (user.role !== "admin" && !user.membersPrivateEnabled) return "team"
  return space
}

/** The rows of the browsed space; every row while Team is hidden. */
export function inBrowsedSpace<T extends { space: Space }>(
  rows: T[],
  space: Space | null,
): T[] {
  return space ? rows.filter((row) => row.space === space) : rows
}
