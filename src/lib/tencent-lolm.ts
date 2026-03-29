import {
  LANE_LABELS,
  dataFileUrl,
  normalizeChampionCatalog,
  normalizeSnapshot,
  sortLaneKeys,
  sortNumericKeys,
  type ChampionCatalog,
  type CompactLeaderboardRow,
  type LaneId,
  type LeaderboardSnapshot,
  type SnapshotMeta,
  type StaticDataManifest,
} from "@/lib/static-data"
import {
  calculateChampionStrengthScore,
  getChampionStrengthTier,
  type ChampionStrengthTier,
} from "@/lib/champion-strength"

export { LANE_LABELS, sortLaneKeys, sortNumericKeys }
export type { LaneId }

export const TIER_LABELS: Record<string, string> = {
  "1": "Diamond+",
  "2": "Master+",
  "3": "Challenger",
  "4": "Peak of the Rift",
}

export const ALL_LANE = "all" as const

export type LeaderboardLaneFilterId = LaneId | typeof ALL_LANE
export type RankSortKey = "strengthScore" | "winRate" | "pickRate" | "banRate"
export type RankSortDirection = "asc" | "desc"
export type RankMovement = {
  currentRank: number
  previousRank: number | null
  delta: number | null
}

export type LeaderboardEntry = {
  alias: string
  avatar: string
  championId: string
  riotSlug: string
  strengthScore: number
  strengthTier: ChampionStrengthTier
  id: string
  lane: LaneId
  laneLabel: string
  name: string
  pickRate: number
  searchText: string
  title: string
  winRate: number
  banRate: number
}

export type LeaderboardPayload = {
  archivedAt: string
  entriesByTier: Record<string, Record<string, LeaderboardEntry[]>>
  latestSnapshotId: string
  previousEntriesByTier: Record<string, Record<string, LeaderboardEntry[]>> | null
  previousSnapshotId: string | null
  snapshotId: string
  snapshots: SnapshotMeta[]
  statDate: string
}

export type ChampionRoleStat = {
  lane: LaneId
  laneLabel: string
  pickRate: number
  previousRank: number | null
  rank: number
  rankDelta: number | null
  winRate: number
  banRate: number
  strengthScore: number
  strengthTier: ChampionStrengthTier
}

export type ChampionStatsBucket = {
  bucket: string
  label: string
  roles: ChampionRoleStat[]
}

export type ChampionStatsHistoryPoint = {
  archivedAt: string
  banRate: number
  rank: number
  snapshotId: string
  statDate: string
  strengthScore: number
  strengthTier: ChampionStrengthTier
  winRate: number
  pickRate: number
}

export type ChampionStatsHistorySeries = {
  bucket: string
  label: string
  lane: LaneId
  laneLabel: string
  points: ChampionStatsHistoryPoint[]
}

export type ChampionHeroStatsPayload = {
  archivedAt: string
  buckets: ChampionStatsBucket[]
  history: ChampionStatsHistorySeries[]
  latestSnapshotId: string
  previousSnapshotId: string | null
  snapshotId: string
  statDate: string
}

let manifestPromise: Promise<StaticDataManifest> | null = null
let championCatalogPromise: Promise<ChampionCatalog> | null = null
const snapshotCache = new Map<string, Promise<LeaderboardSnapshot>>()

async function readJson<T>(pathname: string) {
  const response = await fetch(dataFileUrl(pathname))

  if (!response.ok) {
    throw new Error(`Request failed for ${pathname}: ${response.status}`)
  }

  return (await response.json()) as T
}

async function loadManifest() {
  manifestPromise ??= readJson<StaticDataManifest>("data/manifest.v1.json")
  return manifestPromise
}

async function loadChampionCatalog() {
  if (!championCatalogPromise) {
    championCatalogPromise = loadManifest().then((manifest) =>
      readJson<ChampionCatalog>(manifest.championsPath)
    )
  }

  return championCatalogPromise
}

async function loadSnapshotByPath(pathname: string) {
  const cachedSnapshot = snapshotCache.get(pathname)

  if (cachedSnapshot) {
    return cachedSnapshot
  }

  const snapshotPromise = readJson<LeaderboardSnapshot>(pathname)
  snapshotCache.set(pathname, snapshotPromise)

  return snapshotPromise
}

function pickSnapshotMeta(manifest: StaticDataManifest, snapshotId?: string) {
  return (
    manifest.snapshots.find((snapshot) => snapshot.id === snapshotId) ??
    manifest.snapshots.find((snapshot) => snapshot.id === manifest.latestSnapshotId) ??
    null
  )
}

function pickPreviousSnapshotMeta(
  manifest: StaticDataManifest,
  snapshotId: string
) {
  const snapshotIndex = manifest.snapshots.findIndex(
    (snapshot) => snapshot.id === snapshotId
  )

  if (snapshotIndex === -1) {
    return null
  }

  return manifest.snapshots[snapshotIndex + 1] ?? null
}

async function loadSnapshotByMeta(snapshotMeta: SnapshotMeta) {
  const snapshot = await loadSnapshotByPath(snapshotMeta.path)

  if (snapshot.snapshotId !== snapshotMeta.id) {
    throw new Error(
      `Snapshot mismatch for ${snapshotMeta.id} at ${snapshotMeta.path}: received ${snapshot.snapshotId}.`
    )
  }

  return snapshot
}

function compareLeaderboardEntries(
  left: Pick<LeaderboardEntry, RankSortKey>,
  right: Pick<LeaderboardEntry, RankSortKey>,
  sortBy: RankSortKey,
  sortDirection: RankSortDirection
) {
  const delta =
    sortBy === "strengthScore"
      ? left.strengthScore - right.strengthScore
      : sortBy === "winRate"
        ? left.winRate - right.winRate
        : sortBy === "pickRate"
          ? left.pickRate - right.pickRate
          : left.banRate - right.banRate

  return sortDirection === "asc" ? delta : -delta
}

function leaderboardEntryRankKey(
  entry: Pick<LeaderboardEntry, "championId" | "lane">
) {
  return `${entry.championId}:${entry.lane}`
}

function compareStrengthRankEntries(
  left: Pick<
    LeaderboardEntry,
    "championId" | "lane" | "strengthScore" | "winRate" | "pickRate" | "banRate"
  >,
  right: Pick<
    LeaderboardEntry,
    "championId" | "lane" | "strengthScore" | "winRate" | "pickRate" | "banRate"
  >
) {
  if (left.strengthScore !== right.strengthScore) {
    return right.strengthScore - left.strengthScore
  }

  if (left.winRate !== right.winRate) {
    return right.winRate - left.winRate
  }

  if (left.pickRate !== right.pickRate) {
    return right.pickRate - left.pickRate
  }

  if (left.banRate !== right.banRate) {
    return right.banRate - left.banRate
  }

  if (left.lane !== right.lane) {
    return sortLaneKeys([left.lane, right.lane])[0] === left.lane ? -1 : 1
  }

  return left.championId.localeCompare(right.championId)
}

function normalizeRankableRow(compactRow: CompactLeaderboardRow) {
  const [championId, winRate, pickRate, banRate] = compactRow

  return {
    banRate,
    championId,
    pickRate,
    strengthScore: calculateChampionStrengthScore(winRate, pickRate, banRate),
    winRate,
  }
}

function sortChampionRankRows(rows: CompactLeaderboardRow[]) {
  return [...rows].sort((left, right) => {
    const normalizedLeft = normalizeRankableRow(left)
    const normalizedRight = normalizeRankableRow(right)

    if (normalizedLeft.strengthScore !== normalizedRight.strengthScore) {
      return normalizedRight.strengthScore - normalizedLeft.strengthScore
    }

    if (normalizedLeft.winRate !== normalizedRight.winRate) {
      return normalizedRight.winRate - normalizedLeft.winRate
    }

    if (normalizedLeft.pickRate !== normalizedRight.pickRate) {
      return normalizedRight.pickRate - normalizedLeft.pickRate
    }

    if (normalizedLeft.banRate !== normalizedRight.banRate) {
      return normalizedRight.banRate - normalizedLeft.banRate
    }

    return normalizedLeft.championId.localeCompare(normalizedRight.championId)
  })
}

function findChampionRank(
  snapshot: LeaderboardSnapshot | null,
  tierKey: string,
  laneKey: LaneId,
  championId: string,
  allowedChampionIds?: Set<string>
) {
  if (!snapshot) {
    return null
  }

  const rows = snapshot.tiers[tierKey]?.[laneKey] ?? []
  const filteredRows = allowedChampionIds
    ? rows.filter(([heroId]) => allowedChampionIds.has(heroId))
    : rows
  const championIndex = sortChampionRankRows(filteredRows).findIndex(([heroId]) => heroId === championId)

  return championIndex === -1 ? null : championIndex + 1
}

function normalizeEntry(
  snapshotId: string,
  tierKey: string,
  laneKey: LaneId,
  rowIndex: number,
  compactRow: CompactLeaderboardRow,
  champions: ChampionCatalog["champions"]
): LeaderboardEntry {
  const [heroId, winRate, pickRate, banRate] = compactRow
  const champion = champions[heroId]
  const strengthScore = calculateChampionStrengthScore(winRate, pickRate, banRate)

  return {
    alias: champion?.alias ?? "",
    avatar: champion?.avatar ? dataFileUrl(champion.avatar) : "",
    championId: heroId,
    riotSlug: champion?.riotSlug ?? "",
    strengthScore,
    strengthTier: getChampionStrengthTier(strengthScore),
    id: `${snapshotId}-${tierKey}-${laneKey}-${heroId}-${rowIndex}`,
    lane: laneKey,
    laneLabel: LANE_LABELS[laneKey] ?? `Lane ${laneKey}`,
    name: champion?.displayName ?? `Hero ${heroId}`,
    pickRate,
    searchText: champion?.searchText ?? `hero ${heroId}`,
    title: champion?.title ?? `Hero ${heroId}`,
    winRate,
    banRate,
  }
}

function buildEntriesByTier(
  snapshot: LeaderboardSnapshot,
  champions: ChampionCatalog["champions"]
) {
  const entriesByTier: Record<string, Record<string, LeaderboardEntry[]>> = {}

  for (const tierKey of sortNumericKeys(Object.keys(snapshot.tiers))) {
    entriesByTier[tierKey] = {}

    for (const laneKey of sortLaneKeys(
      Object.keys(snapshot.tiers[tierKey] ?? {}) as LaneId[]
    )) {
      const rows = snapshot.tiers[tierKey]?.[laneKey] ?? []

      entriesByTier[tierKey][laneKey] = rows.map((row, rowIndex) =>
        normalizeEntry(snapshot.snapshotId, tierKey, laneKey, rowIndex, row, champions)
      )
    }
  }

  return entriesByTier
}

function normalizeChampionRoleStat(
  laneKey: LaneId,
  compactRow: CompactLeaderboardRow,
  rank: number,
  previousRank: number | null
): ChampionRoleStat {
  const [, winRate, pickRate, banRate] = compactRow
  const strengthScore = calculateChampionStrengthScore(winRate, pickRate, banRate)

  return {
    banRate,
    lane: laneKey,
    laneLabel: LANE_LABELS[laneKey] ?? `Lane ${laneKey}`,
    pickRate,
    previousRank,
    rank,
    rankDelta: previousRank === null ? null : previousRank - rank,
    strengthScore,
    strengthTier: getChampionStrengthTier(strengthScore),
    winRate,
  }
}

function buildChampionStatsBuckets(
  snapshot: LeaderboardSnapshot,
  previousSnapshot: LeaderboardSnapshot | null,
  championId: string
): ChampionStatsBucket[] {
  return sortNumericKeys(Object.keys(snapshot.tiers))
    .filter((tierKey) => tierKey !== "0")
    .map((tierKey) => {
      const laneKeys = sortLaneKeys(
        Object.keys(snapshot.tiers[tierKey] ?? {}) as LaneId[]
      )
      const laneOrder = new Map(
        laneKeys.map((laneKey, index) => [laneKey, index] as const)
      )
      const roles = laneKeys
        .map((laneKey) => {
          const laneRows = snapshot.tiers[tierKey]?.[laneKey] ?? []
          const row = laneRows.find(
            ([heroId]) => heroId === championId
          )

          if (!row) {
            return null
          }

          const currentLaneChampionIds = new Set(laneRows.map(([heroId]) => heroId))

          const rank = findChampionRank(snapshot, tierKey, laneKey, championId)

          if (rank === null) {
            return null
          }

          return normalizeChampionRoleStat(
            laneKey,
            row,
            rank,
            findChampionRank(
              previousSnapshot,
              tierKey,
              laneKey,
              championId,
              currentLaneChampionIds
            )
          )
        })
        .filter((role): role is ChampionRoleStat => role !== null)
        .sort((left, right) => {
          if (left.pickRate !== right.pickRate) {
            return right.pickRate - left.pickRate
          }

          return (laneOrder.get(left.lane) ?? Number.MAX_SAFE_INTEGER) -
            (laneOrder.get(right.lane) ?? Number.MAX_SAFE_INTEGER)
        })

      return {
        bucket: tierKey,
        label: TIER_LABELS[tierKey] ?? `Bucket ${tierKey}`,
        roles,
      }
    })
    .filter((bucket) => bucket.roles.length > 0)
}

function buildChampionStatsHistory(
  snapshots: LeaderboardSnapshot[],
  championId: string
) {
  const historySeries = new Map<string, ChampionStatsHistorySeries>()

  for (const snapshot of snapshots) {
    for (const tierKey of sortNumericKeys(Object.keys(snapshot.tiers))) {
      if (tierKey === "0") {
        continue
      }

      for (const laneKey of sortLaneKeys(
        Object.keys(snapshot.tiers[tierKey] ?? {}) as LaneId[]
      )) {
        const laneRows = snapshot.tiers[tierKey]?.[laneKey] ?? []
        const row = laneRows.find(([heroId]) => heroId === championId)

        if (!row) {
          continue
        }

        const rank = findChampionRank(snapshot, tierKey, laneKey, championId)

        if (rank === null) {
          continue
        }

        const [, winRate, pickRate, banRate] = row
        const strengthScore = calculateChampionStrengthScore(winRate, pickRate, banRate)
        const seriesKey = `${tierKey}:${laneKey}`
        const existingSeries = historySeries.get(seriesKey)
        const point = {
          archivedAt: snapshot.fetchedAt,
          banRate,
          pickRate,
          rank,
          snapshotId: snapshot.snapshotId,
          statDate: snapshot.statDate,
          strengthScore,
          strengthTier: getChampionStrengthTier(strengthScore),
          winRate,
        } satisfies ChampionStatsHistoryPoint

        if (existingSeries) {
          existingSeries.points.push(point)
          continue
        }

        historySeries.set(seriesKey, {
          bucket: tierKey,
          label: TIER_LABELS[tierKey] ?? `Bucket ${tierKey}`,
          lane: laneKey,
          laneLabel: LANE_LABELS[laneKey] ?? `Lane ${laneKey}`,
          points: [point],
        })
      }
    }
  }

  const laneOrder = new Map(
    sortLaneKeys(
      Array.from(new Set([...historySeries.values()].map((entry) => entry.lane)))
    ).map((laneKey, index) => [laneKey, index] as const)
  )

  return sortNumericKeys(Array.from(new Set([...historySeries.values()].map((entry) => entry.bucket))))
    .flatMap((bucketKey) =>
      [...historySeries.values()]
        .filter((entry) => entry.bucket === bucketKey)
        .sort((left, right) => {
          return (laneOrder.get(left.lane) ?? Number.MAX_SAFE_INTEGER) -
            (laneOrder.get(right.lane) ?? Number.MAX_SAFE_INTEGER)
        })
    )
    .map((entry) => ({
      ...entry,
      points: [...entry.points].sort((left, right) =>
        left.archivedAt.localeCompare(right.archivedAt)
      ),
    }))
}

function pickSnapshotMetasForHistory(
  manifest: StaticDataManifest,
  snapshotId: string
): SnapshotMeta[] {
  const selectedSnapshotIndex = manifest.snapshots.findIndex(
    (snapshot) => snapshot.id === snapshotId
  )

  if (selectedSnapshotIndex === -1) {
    return []
  }

  return [...manifest.snapshots.slice(selectedSnapshotIndex)].reverse()
}

export async function loadLeaderboards(snapshotId?: string) {
  const [manifest, championCatalog] = await Promise.all([
    loadManifest(),
    loadChampionCatalog(),
  ])
  const selectedSnapshotMeta = pickSnapshotMeta(manifest, snapshotId)

  if (!selectedSnapshotMeta) {
    throw new Error("No published leaderboard snapshots are available.")
  }

  const previousSnapshotMeta = pickPreviousSnapshotMeta(manifest, selectedSnapshotMeta.id)
  const [snapshot, previousSnapshot] = await Promise.all([
    loadSnapshotByMeta(selectedSnapshotMeta),
    previousSnapshotMeta ? loadSnapshotByMeta(previousSnapshotMeta) : null,
  ])

  return {
    archivedAt: snapshot.fetchedAt,
    entriesByTier: buildEntriesByTier(snapshot, championCatalog.champions),
    latestSnapshotId: manifest.latestSnapshotId,
    previousEntriesByTier: previousSnapshot
      ? buildEntriesByTier(previousSnapshot, championCatalog.champions)
      : null,
    previousSnapshotId: previousSnapshot?.snapshotId ?? null,
    snapshotId: snapshot.snapshotId,
    snapshots: manifest.snapshots,
    statDate: snapshot.statDate,
  } satisfies LeaderboardPayload
}

export async function loadChampionHeroStats(
  championId: string,
  snapshotId?: string
) {
  const manifest = await loadManifest()
  const selectedSnapshotMeta = pickSnapshotMeta(manifest, snapshotId)

  if (!selectedSnapshotMeta) {
    throw new Error("No published leaderboard snapshots are available.")
  }

  const previousSnapshotMeta = pickPreviousSnapshotMeta(manifest, selectedSnapshotMeta.id)
  const historySnapshotMetas = pickSnapshotMetasForHistory(
    manifest,
    selectedSnapshotMeta.id
  )
  const [snapshot, previousSnapshot, historySnapshots] = await Promise.all([
    loadSnapshotByMeta(selectedSnapshotMeta),
    previousSnapshotMeta ? loadSnapshotByMeta(previousSnapshotMeta) : null,
    Promise.all(
      historySnapshotMetas.map((historySnapshotMeta: SnapshotMeta) =>
        loadSnapshotByMeta(historySnapshotMeta)
      )
    ),
  ])

  return {
    archivedAt: snapshot.fetchedAt,
    buckets: buildChampionStatsBuckets(snapshot, previousSnapshot, championId),
    history: buildChampionStatsHistory(historySnapshots, championId),
    latestSnapshotId: manifest.latestSnapshotId,
    previousSnapshotId: previousSnapshot?.snapshotId ?? null,
    snapshotId: snapshot.snapshotId,
    statDate: snapshot.statDate,
  } satisfies ChampionHeroStatsPayload
}

export function getLeaderboardEntriesForLaneFilter(
  entriesByLane: Record<string, LeaderboardEntry[]> | null | undefined,
  lane: LeaderboardLaneFilterId
) {
  if (!entriesByLane) {
    return []
  }

  if (lane === ALL_LANE) {
    return sortLaneKeys(Object.keys(entriesByLane) as LaneId[]).flatMap(
      (laneKey) => entriesByLane[laneKey] ?? []
    )
  }

  return entriesByLane[lane] ?? []
}

export function sortLeaderboardEntries(
  entries: LeaderboardEntry[],
  sortBy: RankSortKey,
  sortDirection: RankSortDirection
) {
  return [...entries].sort((left, right) =>
    compareLeaderboardEntries(left, right, sortBy, sortDirection)
  )
}

export function getLeaderboardRankChanges(
  currentEntries: LeaderboardEntry[],
  previousEntries: LeaderboardEntry[]
) {
  const currentKeys = new Set(currentEntries.map((entry) => leaderboardEntryRankKey(entry)))
  const previousRanks = new Map(
    previousEntries
      .filter((entry) => currentKeys.has(leaderboardEntryRankKey(entry)))
      .sort(compareStrengthRankEntries)
      .map(
      (entry, index) => [leaderboardEntryRankKey(entry), index + 1] as const
      )
  )

  return new Map(
    [...currentEntries].sort(compareStrengthRankEntries).map(
      (entry, index) => {
        const previousRank = previousRanks.get(leaderboardEntryRankKey(entry)) ?? null

        return [
          leaderboardEntryRankKey(entry),
          {
            currentRank: index + 1,
            previousRank,
            delta: previousRank === null ? null : previousRank - (index + 1),
          } satisfies RankMovement,
        ] as const
      }
    )
  )
}

export function getLeaderboardEntryRankKey(
  entry: Pick<LeaderboardEntry, "championId" | "lane">
) {
  return leaderboardEntryRankKey(entry)
}

export function resetTencentLolmCacheForTests() {
  manifestPromise = null
  championCatalogPromise = null
  snapshotCache.clear()
}

export function normalizeSourceDataForTests(
  champions: Parameters<typeof normalizeChampionCatalog>[0],
  snapshot: Parameters<typeof normalizeSnapshot>[0]
) {
  return {
    champions: normalizeChampionCatalog(champions),
    snapshot: normalizeSnapshot(snapshot),
  }
}
