import { mkdtemp, readFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { describe, expect, test } from "bun:test"

import { buildSyncArtifacts, syncStaticData } from "../scripts/sync-tencent-lolm"
import { stableSerialize, type HeroListResponse, type SourceLeaderboardResponse } from "../src/lib/static-data"

function createHeroListResponse(title = "Mage") {
  return {
    heroList: {
      "10001": {
        alias: "fox",
        avatar: "https://cdn.example.com/10001.png",
        name: "Ahri",
        poster: "https://cdn.example.com/Ahri_0.jpg",
        title,
      },
      "10002": {
        alias: "monkey",
        avatar: "https://cdn.example.com/10002.png",
        name: "Monkey King",
        poster: "https://cdn.example.com/MonkeyKing_0.jpg",
        title: "Fighter",
      },
    },
  } satisfies HeroListResponse
}

function createLeaderboardResponse(
  statDate = "20260307",
  winRate = "57.40"
) {
  return {
    data: {
      "1": {
        "1": [
          {
            appear_rate_percent: "4.20",
            dtstatdate: statDate,
            forbid_rate_percent: "2.10",
            hero_id: "10001",
            position: "1",
            win_rate_percent: winRate,
          },
        ],
        "2": [
          {
            appear_rate_percent: "5.50",
            dtstatdate: statDate,
            forbid_rate_percent: "3.10",
            hero_id: "10002",
            position: "2",
            win_rate_percent: "52.10",
          },
        ],
      },
    },
  } satisfies SourceLeaderboardResponse
}

function createFetchStub(
  heroList: HeroListResponse,
  leaderboard: SourceLeaderboardResponse
): typeof fetch {
  return (async (url: string | URL | Request) => {
    const href = typeof url === "string" ? url : url instanceof URL ? url.href : url.url
    if (href.endsWith(".png")) {
      return new Response("avatar-bytes", {
        headers: {
          "Content-Type": "image/png",
        },
        status: 200,
      })
    }

    const payload = href.includes("hero_list") ? heroList : leaderboard
    return new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
      },
      status: 200,
    })
  }) as typeof fetch
}

async function readJsonFile<T>(filePath: string) {
  const raw = await readFile(filePath, "utf8")
  return JSON.parse(raw) as T
}

describe("sync-tencent-lolm", () => {
  test("normalizes payloads deterministically regardless of object order", () => {
    const left = {
      b: 1,
      a: {
        d: [2, 3],
        c: "value",
      },
    }
    const right = {
      a: {
        c: "value",
        d: [2, 3],
      },
      b: 1,
    }

    expect(stableSerialize(left)).toBe(stableSerialize(right))
  })

  test("creates the first snapshot and latest files", async () => {
    const dataRoot = await mkdtemp(path.join(os.tmpdir(), "rankedwr-sync-"))
    const summary = await syncStaticData({
      dataRoot,
      fetchImpl: createFetchStub(
        createHeroListResponse(),
        createLeaderboardResponse()
      ),
      now: new Date("2026-03-08T01:17:00.000Z"),
    })

    const manifest = await readJsonFile<{
      latestSnapshotId: string
      snapshots: Array<{ path: string }>
    }>(path.join(dataRoot, "manifest.v1.json"))
    const latestSnapshot = await readJsonFile<{ snapshotId: string }>(
      path.join(dataRoot, "latest.v1.json")
    )
    const immutableSnapshot = await readJsonFile<{ snapshotId: string }>(
      path.join(dataRoot, manifest.snapshots[0]!.path.replace(/^data\//, ""))
    )

    expect(summary.changed).toBe(true)
    expect(summary.snapshotChanged).toBe(true)
    expect(manifest.snapshots).toHaveLength(1)
    expect(manifest.latestSnapshotId).toBe(manifest.snapshots[0]?.path.split("/").pop()?.replace(".json", ""))
    expect(latestSnapshot.snapshotId).toBe(manifest.latestSnapshotId)
    expect(immutableSnapshot.snapshotId).toBe(manifest.latestSnapshotId)
  })

  test("does not create a new snapshot when the payload is unchanged", async () => {
    const dataRoot = await mkdtemp(path.join(os.tmpdir(), "rankedwr-sync-"))
    const fetchImpl = createFetchStub(
      createHeroListResponse(),
      createLeaderboardResponse()
    )

    await syncStaticData({
      dataRoot,
      fetchImpl,
      now: new Date("2026-03-08T01:17:00.000Z"),
    })

    const summary = await syncStaticData({
      dataRoot,
      fetchImpl,
      now: new Date("2026-03-08T09:17:00.000Z"),
    })

    const manifest = await readJsonFile<{ snapshots: unknown[] }>(
      path.join(dataRoot, "manifest.v1.json")
    )

    expect(summary.changed).toBe(false)
    expect(manifest.snapshots).toHaveLength(1)
  })

  test("creates a second snapshot when the payload changes with the same stat date", async () => {
    const dataRoot = await mkdtemp(path.join(os.tmpdir(), "rankedwr-sync-"))

    await syncStaticData({
      dataRoot,
      fetchImpl: createFetchStub(
        createHeroListResponse(),
        createLeaderboardResponse("20260307", "57.40")
      ),
      now: new Date("2026-03-08T01:17:00.000Z"),
    })

    const summary = await syncStaticData({
      dataRoot,
      fetchImpl: createFetchStub(
        createHeroListResponse(),
        createLeaderboardResponse("20260307", "58.00")
      ),
      now: new Date("2026-03-08T09:17:00.000Z"),
    })

    const manifest = await readJsonFile<{ snapshots: Array<{ id: string }> }>(
      path.join(dataRoot, "manifest.v1.json")
    )

    expect(summary.changed).toBe(true)
    expect(summary.snapshotChanged).toBe(true)
    expect(manifest.snapshots).toHaveLength(2)
    expect(manifest.snapshots[0]?.id).not.toBe(manifest.snapshots[1]?.id)
  })

  test("updates champion metadata without creating a new historical snapshot", async () => {
    const dataRoot = await mkdtemp(path.join(os.tmpdir(), "rankedwr-sync-"))

    await syncStaticData({
      dataRoot,
      fetchImpl: createFetchStub(
        createHeroListResponse("Mage"),
        createLeaderboardResponse()
      ),
      now: new Date("2026-03-08T01:17:00.000Z"),
    })

    const summary = await syncStaticData({
      dataRoot,
      fetchImpl: createFetchStub(
        createHeroListResponse("Nine-Tailed Fox"),
        createLeaderboardResponse()
      ),
      now: new Date("2026-03-08T09:17:00.000Z"),
    })

    const manifest = await readJsonFile<{ snapshots: unknown[] }>(
      path.join(dataRoot, "manifest.v1.json")
    )
    const champions = await readJsonFile<{ champions: Record<string, { title: string }> }>(
      path.join(dataRoot, "champions.v1.json")
    )

    expect(summary.changed).toBe(true)
    expect(summary.championsChanged).toBe(true)
    expect(summary.snapshotChanged).toBe(false)
    expect(manifest.snapshots).toHaveLength(1)
    expect(champions.champions["10001"]?.title).toBe("Nine-Tailed Fox")
  })

  test("fails when dtstatdate is mixed or missing", () => {
    const heroList = createHeroListResponse()
    const leaderboard = createLeaderboardResponse()
    leaderboard.data["1"]["2"][0].dtstatdate = "20260308"

    expect(() =>
      buildSyncArtifacts(heroList, leaderboard, new Date("2026-03-08T01:17:00.000Z"))
    ).toThrow("Leaderboard payload must contain exactly one dtstatdate.")
  })
})
