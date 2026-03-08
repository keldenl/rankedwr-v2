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

export { LANE_LABELS, sortLaneKeys, sortNumericKeys }
export type { LaneId }

export type LeaderboardEntry = {
  alias: string
  avatar: string
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
  snapshotId: string
  snapshots: SnapshotMeta[]
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

  return {
    alias: champion?.alias ?? "",
    avatar: champion?.avatar ?? "",
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

export async function loadLeaderboards(snapshotId?: string) {
  const [manifest, championCatalog] = await Promise.all([
    loadManifest(),
    loadChampionCatalog(),
  ])

  const selectedSnapshotMeta =
    manifest.snapshots.find((snapshot) => snapshot.id === snapshotId) ??
    manifest.snapshots.find((snapshot) => snapshot.id === manifest.latestSnapshotId)

  if (!selectedSnapshotMeta) {
    throw new Error("No published leaderboard snapshots are available.")
  }

  const snapshotPath =
    selectedSnapshotMeta.id === manifest.latestSnapshotId
      ? manifest.latestPath
      : selectedSnapshotMeta.path

  const snapshot = await loadSnapshotByPath(snapshotPath)

  if (snapshot.snapshotId !== selectedSnapshotMeta.id) {
    throw new Error(`Snapshot mismatch for ${selectedSnapshotMeta.id}.`)
  }

  return {
    archivedAt: snapshot.fetchedAt,
    entriesByTier: buildEntriesByTier(snapshot, championCatalog.champions),
    latestSnapshotId: manifest.latestSnapshotId,
    snapshotId: snapshot.snapshotId,
    snapshots: manifest.snapshots,
    statDate: snapshot.statDate,
  } satisfies LeaderboardPayload
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
