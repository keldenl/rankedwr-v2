import { describe, expect, it, mock } from "bun:test"

import {
  championPageDataPath,
  championPagesIndexPath,
  type ChampionPageData,
  type ChampionPagesIndex,
} from "../src/lib/static-data"
import {
  findChampionMatch,
  loadChampionPageByChampionId,
  loadChampionPageBySlug,
  pickChampionMatch,
} from "../src/lib/champion-pages"

describe("champion page loader", () => {
  it("prefers exact and prefix champion matches for home search", async () => {
    const smolderMatch = pickChampionMatch("smolder", [
      {
        championId: "10100",
        displayName: "Smolder",
        riotSlug: "smolder",
        riotUrl: "https://wildrift.leagueoflegends.com/en-us/champions/smolder/",
        searchText: "smolder fiery fledgling",
        title: "The Fiery Fledgling",
      },
      {
        championId: "10002",
        displayName: "Aatrox",
        riotSlug: "aatrox",
        riotUrl: "https://wildrift.leagueoflegends.com/en-us/champions/aatrox/",
        searchText: "aatrox darkin blade",
        title: "The Darkin Blade",
      },
    ])

    expect(smolderMatch?.riotSlug).toBe("smolder")
  })

  it("loads champion pages by champion ID and Riot slug", async () => {
    const championPage = {
      abilities: [],
      championId: "10002",
      difficulty: null,
      fullWidthImageUrl: null,
      generatedAt: "2026-03-08T12:00:00.000Z",
      hash: "page-hash",
      mastheadVideoUrl: "https://cdn.example.com/aatrox.mp4",
      publishDate: "2026-01-16T19:24:39Z",
      riotSlug: "aatrox",
      riotUrl: "https://wildrift.leagueoflegends.com/en-us/champions/aatrox/",
      roles: ["FIGHTER"],
      skins: [],
      subtitle: "The Darkin Blade",
      title: "AATROX",
      version: 1,
    } satisfies ChampionPageData
    const index = {
      champions: {
        "10002": {
          cardImageUrl: "aatrox.jpg",
          championId: "10002",
          listEntryHash: "aatrox:aatrox.jpg",
          pageHash: championPage.hash,
          pagePath: championPageDataPath("aatrox"),
          publishDate: championPage.publishDate,
          riotSlug: "aatrox",
          riotUrl: championPage.riotUrl,
          title: championPage.title,
        },
      },
      generatedAt: "2026-03-08T12:00:00.000Z",
      listHash: "list-hash",
      sourceLocale: "en-us",
      version: 1,
    } satisfies ChampionPagesIndex
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString()

      if (url.endsWith("data/champions.v1.json")) {
        return new Response(
          JSON.stringify({
            champions: {
              "10002": {
                alias: "aatrox",
                avatar: "data/avatars/10002.png",
                displayName: "Aatrox",
                id: "10002",
                riotSlug: "aatrox",
                riotUrl: championPage.riotUrl,
                searchText: "aatrox darkin blade",
                title: "The Darkin Blade",
              },
            },
            generatedAt: "2026-03-08T12:00:00.000Z",
            hash: "catalog-hash",
            version: 1,
          })
        )
      }

      if (url.endsWith(championPagesIndexPath())) {
        return new Response(JSON.stringify(index))
      }

      if (url.endsWith(championPageDataPath("aatrox"))) {
        return new Response(JSON.stringify(championPage))
      }

      throw new Error(`Unexpected fetch ${url}`)
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as typeof fetch

    try {
      const byChampionId = await loadChampionPageByChampionId("10002")
      const bySlug = await loadChampionPageBySlug("aatrox")
      const match = await findChampionMatch("aatr")

      expect(byChampionId.title).toBe("AATROX")
      expect(bySlug.hash).toBe("page-hash")
      expect(match?.championId).toBe("10002")
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
