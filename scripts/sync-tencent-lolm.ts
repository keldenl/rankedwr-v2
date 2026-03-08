import { createHash } from "node:crypto"
import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  STATIC_DATA_VERSION,
  avatarAssetPath,
  normalizeChampionCatalog,
  normalizeSnapshot,
  stableSerialize,
  type ChampionCatalog,
  type HeroListResponse,
  type LeaderboardSnapshot,
  type SnapshotMeta,
  type SourceLeaderboardResponse,
  type StaticDataManifest,
} from "../src/lib/static-data"

const HERO_LIST_URL =
  "https://game.gtimg.cn/images/lgamem/act/lrlib/js/heroList/hero_list.js"
const HERO_RANK_URL = "https://mlol.qt.qq.com/go/lgame_battle_info/hero_rank_list_v2"
const LOLM_REFERER = "https://lolm.qq.com/act/a20220818raider/index.html"
const USER_AGENT = "Mozilla/5.0"

type SyncOptions = {
  dataRoot?: string
  fetchImpl?: typeof fetch
  now?: Date
}

type SyncSummary = {
  avatarFilesChanged: boolean
  changed: boolean
  championsChanged: boolean
  latestSnapshotId: string | null
  manifestChanged: boolean
  snapshotChanged: boolean
  snapshotCount: number
}

type SnapshotArtifacts = {
  rowCount: number
  snapshot: LeaderboardSnapshot
  snapshotMeta: SnapshotMeta
}

type SyncArtifacts = {
  champions: ChampionCatalog
  championsHash: string
  snapshotArtifacts: SnapshotArtifacts
  snapshotHash: string
}

function hashCanonicalValue(value: unknown) {
  return createHash("sha256").update(stableSerialize(value)).digest("hex")
}

function formatSnapshotId(fetchedAt: string, statDate: string, snapshotHash: string) {
  const timestamp = fetchedAt.replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z")
  return `${timestamp}--stat-${statDate}--${snapshotHash.slice(0, 8)}`
}

function snapshotPathFor(snapshotId: string) {
  const [year, month] = snapshotId.split("T")[0].split("-")
  return `data/snapshots/${year}/${month}/${snapshotId}.json`
}

async function readJsonFile<T>(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf8")
    return JSON.parse(raw) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null
    }

    throw error
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

async function fileExists(filePath: string) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function fetchJson<T>(
  fetchImpl: typeof fetch,
  url: string,
  init?: RequestInit
) {
  const response = await fetchImpl(url, init)

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`)
  }

  return (await response.json()) as T
}

async function fetchBytes(fetchImpl: typeof fetch, url: string) {
  const response = await fetchImpl(url)

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`)
  }

  return new Uint8Array(await response.arrayBuffer())
}

async function fetchSourcePayloads(fetchImpl: typeof fetch) {
  const [heroList, leaderboard] = await Promise.all([
    fetchJson<HeroListResponse>(fetchImpl, HERO_LIST_URL),
    fetchJson<SourceLeaderboardResponse>(fetchImpl, HERO_RANK_URL, {
      headers: {
        Referer: LOLM_REFERER,
        "User-Agent": USER_AGENT,
      },
    }),
  ])

  if (!heroList.heroList || !leaderboard.data) {
    throw new Error("Tencent payload shape is invalid.")
  }

  return {
    heroList,
    leaderboard,
  }
}

async function syncAvatarAssets(
  dataRoot: string,
  heroList: HeroListResponse,
  fetchImpl: typeof fetch,
  forceDownload: boolean
) {
  let avatarFilesChanged = false

  for (const [heroId, hero] of Object.entries(heroList.heroList)) {
    const sourceAvatarUrl = hero.avatar

    if (!sourceAvatarUrl) {
      continue
    }

    const relativeAvatarPath = avatarAssetPath(heroId)
    const avatarFilePath = path.join(
      dataRoot,
      relativeAvatarPath.replace(/^data\//, "")
    )
    const avatarAlreadyExists = await fileExists(avatarFilePath)

    if (avatarAlreadyExists && !forceDownload) {
      continue
    }

    const avatarBytes = await fetchBytes(fetchImpl, sourceAvatarUrl)
    await mkdir(path.dirname(avatarFilePath), { recursive: true })
    await writeFile(avatarFilePath, avatarBytes)
    avatarFilesChanged = true
  }

  return avatarFilesChanged
}

export function buildSyncArtifacts(
  heroList: HeroListResponse,
  leaderboard: SourceLeaderboardResponse,
  now: Date
) {
  const generatedAt = now.toISOString()
  const championsMap = normalizeChampionCatalog(heroList)
  const snapshotCore = normalizeSnapshot(leaderboard)
  const championsHash = hashCanonicalValue(championsMap)
  const snapshotHash = hashCanonicalValue({
    statDate: snapshotCore.statDate,
    tiers: snapshotCore.tiers,
  })
  const snapshotId = formatSnapshotId(generatedAt, snapshotCore.statDate, snapshotHash)
  const snapshotPath = snapshotPathFor(snapshotId)

  return {
    champions: {
      champions: championsMap,
      generatedAt,
      hash: championsHash,
      version: STATIC_DATA_VERSION,
    } satisfies ChampionCatalog,
    championsHash,
    snapshotArtifacts: {
      rowCount: snapshotCore.rowCount,
      snapshot: {
        fetchedAt: generatedAt,
        hash: snapshotHash,
        snapshotId,
        statDate: snapshotCore.statDate,
        tiers: snapshotCore.tiers,
        version: STATIC_DATA_VERSION,
      } satisfies LeaderboardSnapshot,
      snapshotMeta: {
        fetchedAt: generatedAt,
        hash: snapshotHash,
        id: snapshotId,
        path: snapshotPath,
        rowCount: snapshotCore.rowCount,
        statDate: snapshotCore.statDate,
        tierKeys: snapshotCore.tierKeys,
      } satisfies SnapshotMeta,
    },
    snapshotHash,
  } satisfies SyncArtifacts
}

export async function syncStaticData({
  dataRoot = path.join(process.cwd(), "public", "data"),
  fetchImpl = fetch,
  now = new Date(),
}: SyncOptions = {}) {
  const manifestPath = path.join(dataRoot, "manifest.v1.json")
  const championsPath = path.join(dataRoot, "champions.v1.json")
  const latestPath = path.join(dataRoot, "latest.v1.json")
  const existingManifest = await readJsonFile<StaticDataManifest>(manifestPath)
  const existingChampions = await readJsonFile<ChampionCatalog>(championsPath)
  const { heroList, leaderboard } = await fetchSourcePayloads(fetchImpl)
  const nextArtifacts = buildSyncArtifacts(heroList, leaderboard, now)

  const existingSnapshotByHash = new Map(
    (existingManifest?.snapshots ?? []).map((snapshot) => [snapshot.hash, snapshot])
  )
  const existingLatestSnapshot =
    (existingManifest?.latestSnapshotId &&
      existingManifest.snapshots.find(
        (snapshot) => snapshot.id === existingManifest.latestSnapshotId
      )) ??
    null

  const championsChanged = existingChampions?.hash !== nextArtifacts.championsHash
  const avatarFilesChanged = await syncAvatarAssets(
    dataRoot,
    heroList,
    fetchImpl,
    championsChanged || !existingChampions
  )
  const duplicateSnapshot = existingSnapshotByHash.get(nextArtifacts.snapshotHash) ?? null
  const snapshotChanged = existingLatestSnapshot?.hash !== nextArtifacts.snapshotHash
  const manifestNeedsBootstrap = !existingManifest || !existingLatestSnapshot

  if (
    !avatarFilesChanged &&
    !championsChanged &&
    !snapshotChanged &&
    !manifestNeedsBootstrap
  ) {
    return {
      avatarFilesChanged: false,
      changed: false,
      championsChanged: false,
      latestSnapshotId: existingManifest.latestSnapshotId,
      manifestChanged: false,
      snapshotChanged: false,
      snapshotCount: existingManifest.snapshots.length,
    } satisfies SyncSummary
  }

  await mkdir(dataRoot, { recursive: true })

  if (championsChanged || !existingChampions) {
    await writeJsonFile(championsPath, nextArtifacts.champions)
  }

  let latestSnapshotId = existingManifest?.latestSnapshotId ?? null
  let snapshots = existingManifest?.snapshots ?? []

  if (snapshotChanged || manifestNeedsBootstrap) {
    if (duplicateSnapshot) {
      latestSnapshotId = duplicateSnapshot.id
    } else {
      const nextSnapshotPath = path.join(
        dataRoot,
        nextArtifacts.snapshotArtifacts.snapshotMeta.path.replace(/^data\//, "")
      )

      await writeJsonFile(nextSnapshotPath, nextArtifacts.snapshotArtifacts.snapshot)
      await writeJsonFile(latestPath, nextArtifacts.snapshotArtifacts.snapshot)

      latestSnapshotId = nextArtifacts.snapshotArtifacts.snapshotMeta.id
      snapshots = [nextArtifacts.snapshotArtifacts.snapshotMeta, ...snapshots]
    }
  } else if (!existingManifest?.latestPath) {
    await writeJsonFile(latestPath, nextArtifacts.snapshotArtifacts.snapshot)
    latestSnapshotId = nextArtifacts.snapshotArtifacts.snapshotMeta.id
    snapshots = [nextArtifacts.snapshotArtifacts.snapshotMeta, ...snapshots]
  }

  if (duplicateSnapshot && snapshotChanged) {
    const duplicateSnapshotPath = path.join(
      dataRoot,
      duplicateSnapshot.path.replace(/^data\//, "")
    )
    const duplicateSnapshotFile = await readJsonFile<LeaderboardSnapshot>(
      duplicateSnapshotPath
    )

    if (duplicateSnapshotFile) {
      await writeJsonFile(latestPath, duplicateSnapshotFile)
    }
  }

  const nextManifest = {
    championsPath: "data/champions.v1.json",
    generatedAt: now.toISOString(),
    latestPath: "data/latest.v1.json",
    latestSnapshotId:
      latestSnapshotId ?? nextArtifacts.snapshotArtifacts.snapshotMeta.id,
    snapshots,
    version: STATIC_DATA_VERSION,
  } satisfies StaticDataManifest

  await writeJsonFile(manifestPath, nextManifest)

  return {
    avatarFilesChanged,
    changed: true,
    championsChanged,
    latestSnapshotId: nextManifest.latestSnapshotId,
    manifestChanged: true,
    snapshotChanged: snapshotChanged || manifestNeedsBootstrap,
    snapshotCount: nextManifest.snapshots.length,
  } satisfies SyncSummary
}

async function main() {
  const summary = await syncStaticData()
  console.log(`SYNC_SUMMARY ${JSON.stringify(summary)}`)
}

if (import.meta.main) {
  await main()
}
