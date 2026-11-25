import { queryOptions } from "@tanstack/react-query"
import { getInstanceSettings, getInstanceStats } from "./server"

export const instanceStatsQueryOptions = () =>
  queryOptions({
    queryKey: ["instance", "stats"] as const,
    queryFn: () => getInstanceStats(),
  })

export const instanceSettingsQueryOptions = () =>
  queryOptions({
    queryKey: ["instance", "settings"] as const,
    queryFn: () => getInstanceSettings(),
  })
