import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router"
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { currentUserQueryOptions } from "@/features/account/queries"
import { drawingsQueryOptions } from "@/features/drawings/queries"
import { foldersQueryOptions } from "@/features/folders/queries"
import { validateSpaceSearch } from "@/features/spaces/browse"
import { ActiveSpaceProvider, useActiveSpace } from "./ActiveSpace"

vi.mock("@/features/account/server", () => ({ getCurrentUser: vi.fn() }))
vi.mock("@/features/drawings/server", () => ({ getDrawings: vi.fn() }))
vi.mock("@/features/folders/server", () => ({ getFolders: vi.fn() }))

beforeEach(() => window.localStorage.setItem("excaliself:last-space", "team"))
afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

function SpaceProbe() {
  const { activeSpace } = useActiveSpace()
  return <p data-testid="active-space">{activeSpace ?? "none"}</p>
}

// Home and a Drawing under the provider; the Drawing loads for a moment, like
// the real one, so the router sits pending between the two.
function renderApp(
  initialEntry: string,
  role: "admin" | "user" = "user",
  membersPrivateEnabled = false,
) {
  const root = createRootRoute({
    component: () => (
      <ActiveSpaceProvider>
        <Outlet />
        <SpaceProbe />
      </ActiveSpaceProvider>
    ),
  })
  const home = createRoute({
    getParentRoute: () => root,
    path: "/draw",
    validateSearch: validateSpaceSearch,
    component: () => <p>Home</p>,
  })
  const drawing = createRoute({
    getParentRoute: () => root,
    path: "/draw/$id",
    loader: () => new Promise((resolve) => setTimeout(resolve, 20)),
    component: () => <p>Drawing</p>,
  })
  const router = createRouter({
    routeTree: root.addChildren([home, drawing]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })

  const client = new QueryClient()
  client.setQueryData(currentUserQueryOptions().queryKey, {
    id: "user-1",
    email: "ada@example.com",
    name: "Ada",
    role,
    image: null,
    hasPassword: true,
    teamEnabled: true,
    membersPrivateEnabled,
  })
  client.setQueryData(drawingsQueryOptions().queryKey, [])
  client.setQueryData(foldersQueryOptions().queryKey, [])
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

test("a bare Home opens this device's last-used space", async () => {
  const router = renderApp("/draw")
  await screen.findByText("Home")
  await vi.waitFor(() =>
    expect(router.state.location.search).toEqual({ space: "team" }),
  )
})

test("leaving Home in Team for a Drawing stays on the Drawing", async () => {
  const router = renderApp("/draw?space=team")
  await screen.findByText("Home")

  await act(() => router.navigate({ to: "/draw/$id", params: { id: "d1" } }))
  await screen.findByText("Drawing")
  // Let any bounce back to Home land before checking.
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
  expect(router.state.location.pathname).toBe("/draw/d1")
})

test("a member's bare Home opens in Team even with a private last-used space", async () => {
  window.localStorage.setItem("excaliself:last-space", "private")
  renderApp("/draw", "user")
  await screen.findByText("Home")
  expect((await screen.findByTestId("active-space")).textContent).toBe("team")
})

test("an admin's bare Home keeps their private last-used space", async () => {
  window.localStorage.setItem("excaliself:last-space", "private")
  renderApp("/draw", "admin")
  await screen.findByText("Home")
  expect((await screen.findByTestId("active-space")).textContent).toBe(
    "private",
  )
})

test("a member's bare Home keeps their private last-used space while the setting is on", async () => {
  window.localStorage.setItem("excaliself:last-space", "private")
  renderApp("/draw", "user", true)
  await screen.findByText("Home")
  expect((await screen.findByTestId("active-space")).textContent).toBe(
    "private",
  )
})
