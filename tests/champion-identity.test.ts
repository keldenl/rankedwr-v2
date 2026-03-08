import { describe, expect, it } from "bun:test"

import {
  buildChampionRiotMapping,
  normalizeChampionIdentityName,
  RIOT_SLUG_OVERRIDES_BY_CHAMPION_ID,
  type RiotChampionListEntry,
} from "../src/lib/champion-identity"
import type { ChampionRecord } from "../src/lib/static-data"
import { computeRiotChampionListHash } from "../scripts/sync-riot-champion-pages"

function buildChampionRecord(
  id: string,
  displayName: string
): ChampionRecord {
  return {
    alias: displayName.toLowerCase(),
    avatar: `data/avatars/${id}.png`,
    displayName,
    id,
    searchText: displayName.toLowerCase(),
    title: displayName,
  }
}

function buildRiotEntry(riotSlug: string, title: string): RiotChampionListEntry {
  return {
    cardImageUrl: `${riotSlug}.jpg`,
    listEntryHash: `${riotSlug}-hash`,
    riotSlug,
    riotUrl: `https://wildrift.leagueoflegends.com/en-us/champions/${riotSlug}/`,
    title,
  }
}

describe("champion identity", () => {
  it("normalizes champion names for deterministic matching", () => {
    expect(normalizeChampionIdentityName("NUNU & WILLUMP")).toBe("nunuwillump")
    expect(normalizeChampionIdentityName("Dr. Mundo")).toBe("drmundo")
  })

  it("maps Riot champions with the explicit override", () => {
    const champions = {
      "10002": buildChampionRecord("10002", "Aatrox"),
      "10008": buildChampionRecord("10008", "Nunu"),
    }
    const riotEntries = [
      buildRiotEntry("aatrox", "AATROX"),
      buildRiotEntry(
        RIOT_SLUG_OVERRIDES_BY_CHAMPION_ID["10008"],
        "NUNU & WILLUMP"
      ),
    ]

    const mapping = buildChampionRiotMapping(champions, riotEntries)

    expect(mapping["10002"].riotSlug).toBe("aatrox")
    expect(mapping["10008"].riotSlug).toBe("nunu-and-willump")
  })

  it("fails when Riot entries are left unmapped", () => {
    const champions = {
      "10002": buildChampionRecord("10002", "Aatrox"),
    }
    const riotEntries = [
      buildRiotEntry("aatrox", "AATROX"),
      buildRiotEntry("ahri", "AHRI"),
    ]

    expect(() => buildChampionRiotMapping(champions, riotEntries)).toThrow(
      "Riot champion list contains unmapped entries"
    )
  })

  it("fails when a local champion cannot be mapped", () => {
    const champions = {
      "10002": buildChampionRecord("10002", "Aatrox"),
      "10003": buildChampionRecord("10003", "Lux"),
    }
    const riotEntries = [buildRiotEntry("aatrox", "AATROX")]

    expect(() => buildChampionRiotMapping(champions, riotEntries)).toThrow(
      "Unable to map champion 10003"
    )
  })

  it("keeps the list hash stable across Riot ordering changes", () => {
    const entries = [
      buildRiotEntry("ahri", "AHRI"),
      buildRiotEntry("aatrox", "AATROX"),
    ]

    expect(computeRiotChampionListHash(entries)).toBe(
      computeRiotChampionListHash([...entries].reverse())
    )
  })
})
