// The space the sidebar shows (spec: Sidebar). On Home and All drawings the
// `space` param is the truth and switching rewrites it; elsewhere the open
// Drawing or folder sets it. Home without a param opens this device's
// last-used space.

import { useQuery } from "@tanstack/react-query"
import { useLocation, useNavigate } from "@tanstack/react-router"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type { Space } from "@/db/schema"
import { currentUserQueryOptions } from "@/features/account/queries"
import { drawingsQueryOptions } from "@/features/drawings/queries"
import { foldersQueryOptions } from "@/features/folders/queries"

const LAST_SPACE_KEY = "excaliself:last-space"

// localStorage can throw (privacy modes); then nothing is remembered.
function readLastSpace() {
  try {
    return window.localStorage.getItem(LAST_SPACE_KEY)
  } catch {
    return null
  }
}
function writeLastSpace(space: Space) {
  try {
    window.localStorage.setItem(LAST_SPACE_KEY, space)
  } catch {}
}

type ActiveSpaceValue = {
  /** Null while Team is hidden: one space, no switch. */
  activeSpace: Space | null
  setActiveSpace: (space: Space) => void
}

// Without the provider (component tests) Team is hidden.
const ActiveSpaceContext = createContext<ActiveSpaceValue>({
  activeSpace: null,
  setActiveSpace: () => {},
})

export function ActiveSpaceProvider({ children }: { children: ReactNode }) {
  const { data: teamEnabled = false } = useQuery({
    ...currentUserQueryOptions(),
    select: (user) => user.teamEnabled,
  })
  const { data: role = "user" } = useQuery({
    ...currentUserQueryOptions(),
    select: (user) => user.role,
  })
  const { data: membersPrivateEnabled = false } = useQuery({
    ...currentUserQueryOptions(),
    select: (user) => user.membersPrivateEnabled,
  })
  // Private is offered to admins, and to members only while the admin
  // setting is on. Otherwise every space the sidebar could show is
  // clamped to Team.
  const privateAllowed = role === "admin" || membersPrivateEnabled
  const { data: drawings = [] } = useQuery(drawingsQueryOptions())
  const { data: folders = [] } = useQuery(foldersQueryOptions())
  const navigate = useNavigate()
  // Path and search from one location: mid-navigation, matchRoute still
  // sees the old path while useSearch already has the new search.
  const { pathname, search } = useLocation()
  const param = search.space
  const [, section, id] = pathname.split("/")

  const onHome = section === "draw" && !id
  const onBrowse = onHome || section === "drawings"
  const openDrawing = section === "draw" && id ? id : null
  const openFolder = section === "folder" && id ? id : null
  const openId = openDrawing ?? openFolder
  const openSpace = openDrawing
    ? drawings.find((d) => d.id === openDrawing)?.space
    : openFolder
      ? folders.find((f) => f.id === openFolder)?.space
      : undefined
  const browseSpace = onBrowse ? (param ?? "private") : undefined

  const decided = browseSpace ?? openSpace
  const clampSpace = (space: Space | undefined): Space | undefined =>
    space === "private" && !privateAllowed ? "team" : space
  const shownDecided = clampSpace(decided)
  const [chosen, setChosen] = useState<Space>(
    () => shownDecided ?? (privateAllowed ? "private" : "team"),
  )
  // Arriving somewhere decides; a switch made there holds until the next
  // arrival (or the open item moving to Team).
  // biome-ignore lint/correctness/useExhaustiveDependencies: openId marks an arrival
  useEffect(() => {
    if (shownDecided) setChosen(shownDecided)
  }, [shownDecided, openId])

  const activeSpace = teamEnabled ? (clampSpace(browseSpace) ?? chosen) : null

  const bareHome = onHome && param === undefined
  useEffect(() => {
    if (!teamEnabled || !bareHome) return
    if (readLastSpace() === "team")
      navigate({ to: "/draw", search: { space: "team" }, replace: true })
  }, [teamEnabled, bareHome, navigate])
  useEffect(() => {
    // A bare Home is about to take the remembered space; don't overwrite it.
    if (activeSpace && !bareHome) writeLastSpace(activeSpace)
  }, [activeSpace, bareHome])

  const setActiveSpace = useCallback(
    (space: Space) => {
      const next = space === "private" && !privateAllowed ? "team" : space
      setChosen(next)
      // Replace, so swipes and spring-loads don't pile up history entries.
      if (onHome)
        navigate({ to: "/draw", search: { space: next }, replace: true })
      else if (onBrowse)
        navigate({
          to: "/drawings",
          search: (prev) => ({ ...prev, space: next }),
          replace: true,
        })
    },
    [onHome, onBrowse, navigate, privateAllowed],
  )

  const value = useMemo(
    () => ({ activeSpace, setActiveSpace }),
    [activeSpace, setActiveSpace],
  )
  return (
    <ActiveSpaceContext.Provider value={value}>
      {children}
    </ActiveSpaceContext.Provider>
  )
}

export function useActiveSpace() {
  return useContext(ActiveSpaceContext)
}
