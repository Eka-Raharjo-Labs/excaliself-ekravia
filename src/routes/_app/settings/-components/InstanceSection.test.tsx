import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import {
  instanceSettingsQueryOptions,
  instanceStatsQueryOptions,
} from "@/features/instance/queries"
import {
  getInstanceSettings,
  getInstanceStats,
  setMembersPrivateEnabled,
} from "@/features/instance/server"
import { InstanceSection } from "./InstanceSection"

// The query modules import the server functions, which import the db — stub
// the server-function edge (the cache is seeded, so the queries are never
// called; the mutation is asserted on the mock instead).
vi.mock("@/features/instance/server", () => ({
  getInstanceStats: vi.fn(),
  getInstanceSettings: vi.fn(),
  setMembersPrivateEnabled: vi.fn(),
}))
vi.mock("@/features/account/server", () => ({
  getCurrentUser: vi.fn(),
}))

const stats = {
  version: "0.1.0",
  userCount: 3,
  drawingCount: 12,
  storageBytes: 1572864,
}
const settings = { membersPrivateEnabled: false }

// Auto-cleanup needs vitest globals, which this repo leaves off.
beforeEach(() => {
  // Refetches (e.g. after the toggle) resolve to the seeded data.
  vi.mocked(getInstanceStats).mockResolvedValue(stats)
  vi.mocked(getInstanceSettings).mockResolvedValue(settings)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

function renderSection({ seed = true } = {}) {
  const queryClient = new QueryClient()
  if (seed) {
    queryClient.setQueryData(instanceStatsQueryOptions().queryKey, stats)
    queryClient.setQueryData(instanceSettingsQueryOptions().queryKey, settings)
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <InstanceSection />
    </QueryClientProvider>,
  )
}

test("the About page shows version, user count, drawing count, and storage", () => {
  renderSection()
  expect(screen.getByText("v0.1.0")).not.toBeNull()
  expect(screen.getByText("3")).not.toBeNull()
  expect(screen.getByText("12")).not.toBeNull()
  expect(screen.getByText("1.5 MB")).not.toBeNull()
})

test("the releases link points at the project's GitHub releases", () => {
  renderSection()
  const link = screen.getByRole("link", { name: "Release notes on GitHub" })
  expect(link.getAttribute("href")).toBe(
    "https://github.com/maciekzygmunt/excaliself/releases",
  )
})

test("the member Private toggle is the page's only control", () => {
  renderSection()
  expect(screen.queryAllByRole("button")).toHaveLength(1)
  expect(screen.getByRole("button", { name: "Turn on" })).not.toBeNull()
  expect(screen.queryAllByRole("textbox")).toHaveLength(0)
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0)
})

test("turning the toggle on calls the server function", async () => {
  vi.mocked(getInstanceSettings).mockResolvedValue({
    membersPrivateEnabled: false,
  })
  renderSection()
  fireEvent.click(screen.getByRole("button", { name: "Turn on" }))

  await vi.waitFor(() =>
    expect(vi.mocked(setMembersPrivateEnabled)).toHaveBeenCalledWith({
      data: { enabled: true },
    }),
  )
})

test("the skeleton appears only after the grace period", () => {
  vi.useFakeTimers()
  vi.mocked(getInstanceStats).mockReturnValue(new Promise(() => {}))
  const { container } = renderSection({ seed: false })

  // Within the grace period nothing renders — no skeleton flash.
  expect(container.querySelector("[data-slot='skeleton']")).toBeNull()

  act(() => vi.advanceTimersByTime(150))
  expect(container.querySelector("[data-slot='skeleton']")).not.toBeNull()
})
