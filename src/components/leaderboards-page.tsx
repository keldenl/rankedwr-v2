import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
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
  LANE_LABELS,
  loadLeaderboards,
  sortNumericKeys,
  type LaneId,
  type LeaderboardEntry,
  type LeaderboardPayload,
} from "@/lib/tencent-lolm"

type SortKey = "winRate" | "pickRate" | "banRate"
type SortDirection = "asc" | "desc"

const DEFAULT_TIER = "1"
const DEFAULT_LANE: LaneId = "2"

const sortLabels: Record<SortKey, string> = {
  winRate: "Win",
  pickRate: "Pick",
  banRate: "Ban",
}

const sortAccessors: Record<SortKey, (entry: LeaderboardEntry) => number> = {
  winRate: (entry) => entry.winRate,
  pickRate: (entry) => entry.pickRate,
  banRate: (entry) => entry.banRate,
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
  return `Bucket ${bucket}`
}

function formatDate(date: string | null) {
  if (!date || date.length !== 8) {
    return "Unknown"
  }

  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
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
      <Empty className="border border-border">
        <EmptyHeader>
          <EmptyTitle>No rows found</EmptyTitle>
          <EmptyDescription>
            Try a different search term, lane, tier, or sort.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <Table>
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Champion</TableHead>
          <TableHead>Lane</TableHead>
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
                aria-sort={
                  isActive
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-3"
                  onClick={() => onSortChange(sortKey)}
                >
                  {label}
                  {isActive ? (
                    sortDirection === "asc" ? (
                      <ArrowUp data-icon="inline-end" />
                    ) : (
                      <ArrowDown data-icon="inline-end" />
                    )
                  ) : (
                    <ArrowUpDown data-icon="inline-end" />
                  )}
                </Button>
              </TableHead>
            )
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry, index) => (
          <TableRow key={entry.id}>
            <TableCell className="text-muted-foreground">{index + 1}</TableCell>
            <TableCell>
              <div className="flex min-w-0 items-center gap-3">
                <Avatar size="lg" className="rounded-md">
                  <AvatarImage src={entry.avatar} alt={entry.name} />
                  <AvatarFallback className="rounded-md">
                    {initialsFromName(entry.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{entry.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {entry.title}
                    {entry.alias ? ` · ${entry.alias}` : ""}
                  </span>
                </div>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {entry.laneLabel}
            </TableCell>
            <TableCell>{formatPercent(entry.winRate)}</TableCell>
            <TableCell>{formatPercent(entry.pickRate)}</TableCell>
            <TableCell>{formatPercent(entry.banRate)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function LeaderboardsPage() {
  const initialFilters = useMemo(parseFiltersFromUrl, [])
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

        const tiers = sortNumericKeys(Object.keys(nextPayload.entriesByTier))
        const lanes = sortNumericKeys(
          Object.keys(nextPayload.entriesByTier[pickDefaultTier(tiers)] ?? {})
        )

        setPayload(nextPayload)
        setSelectedTier(pickDefaultTier(tiers))
        setSelectedLane(pickDefaultLane(lanes) as LaneId)
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
  }, [])

  const tierKeys = useMemo(
    () => sortNumericKeys(Object.keys(payload?.entriesByTier ?? {})),
    [payload]
  )

  const laneKeys = useMemo(
    () =>
      sortNumericKeys(
        Object.keys(payload?.entriesByTier[selectedTier] ?? {})
      ) as LaneId[],
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
      const accessor = sortAccessors[sortBy]
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
    <main className="min-h-screen bg-background px-6 py-8 text-foreground">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1">
              <div className="text-sm uppercase tracking-[0.16em] text-muted-foreground">
                RankedWR
              </div>
              <CardTitle>Wild Rift leaderboards</CardTitle>
              <CardDescription>
                Live data pulled from Tencent&apos;s current Wild Rift leaderboard
                endpoints. This page stays intentionally bare bones and uses the
                raw rank buckets exposed by the API.
              </CardDescription>
            </div>
            <CardAction>
              <Button variant="outline" asChild>
                <a href="/">Home</a>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                Updated {formatDate(payload?.updatedAt ?? null)}
              </Badge>
              <Badge variant="outline">Source: hero_rank_list_v2</Badge>
              <Badge variant="outline">Hero meta: hero_list.js</Badge>
            </div>

            <Separator />

            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="leaderboard-search">
                  Champion search
                </FieldLabel>
                <Input
                  id="leaderboard-search"
                  type="search"
                  name="leaderboard-search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by champion name, title, or alias…"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
            </FieldGroup>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Rank bucket</p>
                <ToggleGroup
                  type="single"
                  value={selectedTier}
                  onValueChange={(value) => {
                    if (value) {
                      setSelectedTier(value)
                    }
                  }}
                  variant="outline"
                  className="w-full flex-wrap"
                >
                  {tierKeys.map((tierKey) => (
                    <ToggleGroupItem
                      key={tierKey}
                      value={tierKey}
                    >
                      {bucketLabel(tierKey)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Lane</p>
                <ToggleGroup
                  type="single"
                  value={selectedLane}
                  onValueChange={(value) => {
                    if (value) {
                      setSelectedLane(value as LaneId)
                    }
                  }}
                  variant="outline"
                  className="w-full flex-wrap"
                >
                  {laneKeys.map((laneKey) => (
                    <ToggleGroupItem
                      key={laneKey}
                      value={laneKey}
                    >
                      {LANE_LABELS[laneKey]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card size="sm">
            <CardContent className="text-sm text-muted-foreground">
              Loading leaderboards…
            </CardContent>
          </Card>
        ) : null}

        {!isLoading && error ? (
          <Card size="sm" className="ring-destructive/20">
            <CardContent className="text-sm text-destructive">
              <div>{error}</div>
              <div className="mt-2 text-muted-foreground">
                In development this works through Vite&apos;s proxy. In production
                you&apos;ll need the same `/api/hero-list` and `/api/hero-rank-list`
                routes available behind your host because Tencent only CORS-allows
                `https://lolm.qq.com`.
              </div>
            </CardContent>
          </Card>
        ) : null}

        {!isLoading && !error ? (
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>
                {visibleEntries.length} champions for {bucketLabel(selectedTier)} ·{" "}
                {LANE_LABELS[selectedLane]} sorted by {sortLabels[sortBy]}{" "}
                ({sortDirection}).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeaderboardTable
                entries={visibleEntries}
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={handleSortChange}
              />
            </CardContent>
          </Card>
        ) : null}
      </section>
    </main>
  )
}
