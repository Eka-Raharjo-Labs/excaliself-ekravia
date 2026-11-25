import { createFileRoute } from "@tanstack/react-router"
import {
  instanceSettingsQueryOptions,
  instanceStatsQueryOptions,
} from "@/features/instance/queries"
import { useDocumentTitle } from "@/lib/document-title"
import { adminMiddleware } from "@/middleware/admin"
import { m } from "@/paraglide/messages"
import { InstanceSection } from "./-components/InstanceSection"

// Admin-only: the middleware guards document requests, and the loader's
// admin-gated queries throw the same redirect on client-side navigation.
export const Route = createFileRoute("/_app/settings/instance")({
  server: {
    middleware: [adminMiddleware],
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(instanceStatsQueryOptions()),
      context.queryClient.ensureQueryData(instanceSettingsQueryOptions()),
    ])
  },
  component: InstancePage,
})

function InstancePage() {
  useDocumentTitle(m.settings_nav_instance(), { chrome: true })
  return <InstanceSection />
}
