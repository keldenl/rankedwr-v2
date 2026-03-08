export const LANE_LABELS = {
  "1": "Mid",
  "2": "Solo",
  "3": "Duo",
  "4": "Support",
  "5": "Jungle",
} as const

export type LaneId = keyof typeof LANE_LABELS

export const LANE_ORDER: LaneId[] = ["2", "5", "1", "3", "4"]

type HeroRecord = {
  alias?: string
  avatar?: string
  heroId: string
  name?: string
  poster?: string
  title?: string
}

type HeroListResponse = {
  heroList: Record<string, HeroRecord>
}

type RawLeaderboardEntry = {
  appear_rate_percent: string
  dtstatdate: string
  forbid_rate_percent: string
  hero_id: string
  position: LaneId
  win_rate_percent: string
}

type RawLeaderboardResponse = {
  data: Record<string, Record<string, RawLeaderboardEntry[]>>
}

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
  entriesByTier: Record<string, Record<string, LeaderboardEntry[]>>
  updatedAt: string | null
}

const heroListUrl =
  `${import.meta.env.VITE_LOLM_PROXY_BASE ?? ""}/api/hero-list`
const heroRankListUrl =
  `${import.meta.env.VITE_LOLM_PROXY_BASE ?? ""}/api/hero-rank-list`

function championNameFromPoster(poster?: string) {
  if (!poster) {
    return "Unknown"
  }

  const fileName = poster.split("/").pop() ?? poster
  const stem = fileName.split("_")[0] ?? fileName
  const withSpaces = stem.replace(/([A-Z]+)/g, " $1").trim()

  if (withSpaces === "Monkey King") {
    return "Wukong"
  }

  return withSpaces
}

function numberFromPercent(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function sortKeys(source: string[]) {
  return [...source].sort((left, right) => {
    const leftNumber = Number.parseInt(left, 10)
    const rightNumber = Number.parseInt(right, 10)
    return leftNumber - rightNumber
  })
}

async function readJson<T>(url: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`)
  }

  return (await response.json()) as T
}

function normalizeEntry(
  tierKey: string,
  laneKey: LaneId,
  rawEntry: RawLeaderboardEntry,
  heroMap: Map<string, HeroRecord>
): LeaderboardEntry {
  const hero = heroMap.get(rawEntry.hero_id)
  const name = championNameFromPoster(hero?.poster)
  const title = hero?.title ?? hero?.name ?? `Hero ${rawEntry.hero_id}`
  const alias = hero?.alias ?? ""

  return {
    alias,
    avatar: hero?.avatar ?? "",
    id: `${tierKey}-${laneKey}-${rawEntry.hero_id}`,
    lane: laneKey,
    laneLabel: LANE_LABELS[laneKey] ?? `Lane ${laneKey}`,
    name,
    pickRate: numberFromPercent(rawEntry.appear_rate_percent),
    searchText: `${name} ${title} ${hero?.name ?? ""} ${alias}`.toLowerCase(),
    title,
    winRate: numberFromPercent(rawEntry.win_rate_percent),
    banRate: numberFromPercent(rawEntry.forbid_rate_percent),
  }
}

export function sortNumericKeys(source: string[]) {
  return sortKeys(source)
}

export function sortLaneKeys(source: LaneId[]) {
  const laneOrderMap = new Map(
    LANE_ORDER.map((laneId, index) => [laneId, index] as const)
  )

  return [...source].sort((left, right) => {
    const leftIndex = laneOrderMap.get(left) ?? Number.MAX_SAFE_INTEGER
    const rightIndex = laneOrderMap.get(right) ?? Number.MAX_SAFE_INTEGER

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex
    }

    return left.localeCompare(right)
  })
}

export async function loadLeaderboards(): Promise<LeaderboardPayload> {
  const [heroListResponse, rawLeaderboardResponse] = await Promise.all([
    readJson<HeroListResponse>(heroListUrl),
    readJson<RawLeaderboardResponse>(heroRankListUrl),
  ])

  const heroMap = new Map(Object.entries(heroListResponse.heroList))
  const entriesByTier: Record<string, Record<string, LeaderboardEntry[]>> = {}

  let updatedAt: string | null = null

  for (const tierKey of sortKeys(Object.keys(rawLeaderboardResponse.data))) {
    entriesByTier[tierKey] = {}

    for (const laneKey of sortKeys(
      Object.keys(rawLeaderboardResponse.data[tierKey] ?? {})
    ) as LaneId[]) {
      const rawEntries = rawLeaderboardResponse.data[tierKey]?.[laneKey] ?? []

      if (!updatedAt && rawEntries[0]?.dtstatdate) {
        updatedAt = rawEntries[0].dtstatdate
      }

      entriesByTier[tierKey][laneKey] = rawEntries.map((rawEntry) =>
        normalizeEntry(tierKey, laneKey, rawEntry, heroMap)
      )
    }
  }

  return {
    entriesByTier,
    updatedAt,
  }
}
