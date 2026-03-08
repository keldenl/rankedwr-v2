import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, CircleHelp, Search } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  LANE_LABELS,
  loadLeaderboards,
  sortLaneKeys,
  sortNumericKeys,
  type LaneId,
  type LeaderboardEntry,
  type LeaderboardPayload,
} from "@/lib/tencent-lolm"
import { SiteHeader } from "@/components/site-header"

type SortKey = "winRate" | "pickRate" | "banRate"
type SortDirection = "asc" | "desc"

const DEFAULT_TIER = "1"
const DEFAULT_LANE: LaneId = "2"

const TIER_LABELS: Record<string, string> = {
  "1": "Diamond+",
  "2": "Master+",
  "3": "Challenger",
  "4": "Peak of the Rift",
}

function pickDefaultTier(tiers: string[]) {
  if (tiers.includes(DEFAULT_TIER)) {
    return DEFAULT_TIER
  }

  return tiers[0] ?? DEFAULT_TIER
}

function pickDefaultLane(lanes: string[]) {
  if (lanes.includes(DEFAULT_LANE)) {
    return DEFAULT_LANE
  }

  return (lanes[0] as LaneId | undefined) ?? DEFAULT_LANE
}

function bucketLabel(bucket: string) {
  return TIER_LABELS[bucket] ?? `Bucket ${bucket}`
}

function renderBucketLabel(bucket: string) {
  const label = bucketLabel(bucket)

  if (bucket !== "4") {
    return label
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-hidden="true"
            className="inline-flex size-4 items-center justify-center text-muted-foreground"
          >
            <CircleHelp className="size-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          China-only elite competitive ladder (similar to Legendary Ranked)
        </TooltipContent>
      </Tooltip>
    </span>
  )
}

function formatDate(date: string | null) {
  if (!date || date.length !== 8) {
    return "Unknown"
  }

  const parsedDate = new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(4, 6)) - 1,
    Number(date.slice(6, 8))
  )

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsedDate)
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`
}

function initialsFromName(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")

  return letters || "?"
}

function parseFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const q = params.get("q") ?? ""
  const tier = params.get("tier") ?? DEFAULT_TIER
  const lane = (params.get("lane") as LaneId | null) ?? DEFAULT_LANE
  const sort = params.get("sort")
  const direction = params.get("direction")

  return {
    q,
    tier,
    lane,
    sort:
      sort === "pickRate" || sort === "banRate" || sort === "winRate"
        ? sort
        : "winRate",
    direction: direction === "asc" ? "asc" : "desc",
  } satisfies {
    q: string
    tier: string
    lane: LaneId
    sort: SortKey
    direction: SortDirection
  }
}

function LeaderboardTable({
  entries,
  sortBy,
  sortDirection,
  onSortChange,
}: {
  entries: LeaderboardEntry[]
  sortBy: SortKey
  sortDirection: SortDirection
  onSortChange: (sortKey: SortKey) => void
}) {
  if (!entries.length) {
    return (
      <div className="rift-empty-state">
        <p className="text-sm font-medium text-foreground">
          No champions matched this filter.
        </p>
      </div>
    )
  }

  return (
    <div className="rift-table-shell px-3 sm:px-4">
      <Table className="rift-table min-w-[680px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Rank</TableHead>
            <TableHead>Champion</TableHead>
            {(
              [
                ["winRate", "Win"],
                ["pickRate", "Pick"],
                ["banRate", "Ban"],
              ] as const
            ).map(([sortKey, label]) => {
              const isActive = sortBy === sortKey

              return (
                <TableHead
                  key={sortKey}
                  className="text-right"
                  aria-sort={
                    isActive
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    className="rift-sort-button"
                    onClick={() => onSortChange(sortKey)}
                  >
                    {label}
                    {isActive ? (
                      sortDirection === "asc" ? (
                        <ArrowUp />
                      ) : (
                        <ArrowDown />
                      )
                    ) : (
                      <ArrowUpDown />
                    )}
                  </button>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody className="tabular-nums">
          {entries.map((entry, index) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium text-muted-foreground">
                {index + 1}
              </TableCell>
              <TableCell>
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar size="lg" className="rounded-xl">
                    <AvatarImage
                      src={entry.avatar}
                      alt={entry.name}
                      className="rounded-xl"
                    />
                    <AvatarFallback className="rounded-xl bg-muted text-xs">
                      {initialsFromName(entry.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate font-medium text-foreground">
                    {entry.name}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatPercent(entry.winRate)}
              </TableCell>
              <TableCell className="text-right">
                {formatPercent(entry.pickRate)}
              </TableCell>
              <TableCell className="text-right">
                {formatPercent(entry.banRate)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function LeaderboardsPage() {
  const [initialFilters] = useState(parseFiltersFromUrl)
  const [payload, setPayload] = useState<LeaderboardPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState(initialFilters.q)
  const [selectedTier, setSelectedTier] = useState(initialFilters.tier)
  const [selectedLane, setSelectedLane] = useState<LaneId>(initialFilters.lane)
  const [sortBy, setSortBy] = useState<SortKey>(initialFilters.sort)
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    initialFilters.direction
  )
  const deferredSearchQuery = useDeferredValue(searchQuery)

  useEffect(() => {
    let cancelled = false

    async function run() {
      setIsLoading(true)
      setError(null)

      try {
        const nextPayload = await loadLeaderboards()

        if (cancelled) {
          return
        }

        const tiers = sortNumericKeys(Object.keys(nextPayload.entriesByTier)).filter(
          (tierKey) =>
            tierKey !== "0" &&
            Object.values(nextPayload.entriesByTier[tierKey] ?? {}).some(
              (entries) => entries.length > 0
            )
        )
        const nextTier = tiers.includes(initialFilters.tier)
          ? initialFilters.tier
          : pickDefaultTier(tiers)
        const lanes = sortLaneKeys(
          Object.keys(nextPayload.entriesByTier[nextTier] ?? {}) as LaneId[]
        )
        const nextLane = lanes.includes(initialFilters.lane)
          ? initialFilters.lane
          : pickDefaultLane(lanes)

        setPayload(nextPayload)
        setSelectedTier(nextTier)
        setSelectedLane(nextLane as LaneId)
      } catch (caughtError) {
        if (cancelled) {
          return
        }

        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load Tencent leaderboard data."

        setError(message)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [initialFilters])

  const tierKeys = useMemo(
    () =>
      sortNumericKeys(Object.keys(payload?.entriesByTier ?? {})).filter(
        (tierKey) =>
          tierKey !== "0" &&
          Object.values(payload?.entriesByTier[tierKey] ?? {}).some(
            (entries) => entries.length > 0
          )
      ),
    [payload]
  )

  const laneKeys = useMemo(
    () =>
      sortLaneKeys(
        Object.keys(payload?.entriesByTier[selectedTier] ?? {}) as LaneId[]
      ),
    [payload, selectedTier]
  )

  useEffect(() => {
    if (!laneKeys.length) {
      return
    }

    if (!laneKeys.includes(selectedLane)) {
      setSelectedLane(pickDefaultLane(laneKeys) as LaneId)
    }
  }, [laneKeys, selectedLane])

  useEffect(() => {
    const params = new URLSearchParams()

    if (searchQuery.trim()) {
      params.set("q", searchQuery.trim())
    }

    params.set("tier", selectedTier)
    params.set("lane", selectedLane)
    params.set("sort", sortBy)
    params.set("direction", sortDirection)

    const nextSearch = params.toString()
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`
    window.history.replaceState(null, "", nextUrl)
  }, [searchQuery, selectedLane, selectedTier, sortBy, sortDirection])

  const visibleEntries = useMemo(() => {
    const tierEntries = payload?.entriesByTier[selectedTier]

    if (!tierEntries) {
      return []
    }

    const baseEntries = tierEntries[selectedLane] ?? []
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase()

    const filteredEntries = normalizedQuery
      ? baseEntries.filter((entry) => entry.searchText.includes(normalizedQuery))
      : baseEntries

    return [...filteredEntries].sort((left, right) => {
      const accessor =
        sortBy === "winRate"
          ? (entry: LeaderboardEntry) => entry.winRate
          : sortBy === "pickRate"
            ? (entry: LeaderboardEntry) => entry.pickRate
            : (entry: LeaderboardEntry) => entry.banRate
      const delta = accessor(left) - accessor(right)
      return sortDirection === "asc" ? delta : -delta
    })
  }, [
    deferredSearchQuery,
    payload,
    selectedLane,
    selectedTier,
    sortBy,
    sortDirection,
  ])

  function handleSortChange(nextSortKey: SortKey) {
    if (sortBy === nextSortKey) {
      setSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc"
      )
      return
    }

    setSortBy(nextSortKey)
    setSortDirection("desc")
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <a href="#leaderboard-results" className="skip-link">
        Skip to results
      </a>

      <SiteHeader rightLabel="Leaderboards" rightHref="/leaderboards" />

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-5 sm:px-6 sm:py-6">
        <div className="rift-leaderboard-title text-center">
          <h1 className="rift-page-title">Leaderboards</h1>
        </div>

        <div className="rift-leaderboard-filter-stack">
          <TooltipProvider>
            <ToggleGroup
              type="single"
              value={selectedTier}
              onValueChange={(value) => {
                if (value) {
                  setSelectedTier(value)
                }
              }}
              variant="outline"
              className="rift-filter-group rift-filter-group--tier justify-center"
            >
              {tierKeys.map((tierKey) => (
                <ToggleGroupItem
                  key={tierKey}
                  value={tierKey}
                  className="rift-filter-item"
                >
                  {renderBucketLabel(tierKey)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </TooltipProvider>

          <div className="rift-leaderboard-controls grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <InputGroup className="rift-leaderboard-search h-11">
                <InputGroupInput
                  id="leaderboard-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search champion"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Champion search"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    variant="default"
                    size="icon-sm"
                    className="rift-search-submit rift-search-submit--solid"
                    aria-hidden="true"
                    tabIndex={-1}
                  >
                    <Search />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </div>

            <ToggleGroup
              type="single"
              value={selectedLane}
              onValueChange={(value) => {
                if (value) {
                  setSelectedLane(value as LaneId)
                }
              }}
              variant="outline"
              className="rift-filter-group rift-filter-group--lane lg:w-auto lg:flex-nowrap"
            >
              {laneKeys.map((laneKey) => (
                <ToggleGroupItem
                  key={laneKey}
                  value={laneKey}
                  className="rift-filter-item"
                >
                  {LANE_LABELS[laneKey]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        <div id="leaderboard-results" className="rift-leaderboard-results">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to load leaderboards</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="rift-loading-state">
              <Spinner className="size-6" />
            </div>
          ) : (
            <LeaderboardTable
              entries={visibleEntries}
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSortChange={handleSortChange}
            />
          )}
        </div>

        <div className="pt-1 text-center">
          <p className="rift-updated-text">
            Last updated {formatDate(payload?.updatedAt ?? null)}
          </p>
        </div>
      </section>
    </main>
  )
}
