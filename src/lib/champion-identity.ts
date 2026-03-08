import type { ChampionRecord } from "./static-data"

export type RiotChampionListEntry = {
  riotSlug: string
  riotUrl: string
  title: string
  cardImageUrl: string
  listEntryHash: string
}

export const RIOT_SLUG_OVERRIDES_BY_CHAMPION_ID = {
  "10008": "nunu-and-willump",
} as const

export function normalizeChampionIdentityName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function appendMappedChampion(
  mapping: Record<string, RiotChampionListEntry>,
  championId: string,
  entry: RiotChampionListEntry
) {
  if (mapping[championId]) {
    throw new Error(`Duplicate Riot mapping for champion ${championId}.`)
  }

  mapping[championId] = entry
}

export function buildChampionRiotMapping(
  champions: Record<string, ChampionRecord>,
  riotEntries: RiotChampionListEntry[]
) {
  const mapping: Record<string, RiotChampionListEntry> = {}
  const riotEntriesBySlug = new Map(riotEntries.map((entry) => [entry.riotSlug, entry]))
  const usedSlugs = new Set<string>()

  for (const [championId, riotSlug] of Object.entries(
    RIOT_SLUG_OVERRIDES_BY_CHAMPION_ID
  )) {
    const champion = champions[championId]

    if (!champion) {
      continue
    }

    const entry = riotEntriesBySlug.get(riotSlug)

    if (!entry) {
      throw new Error(`Override references unknown Riot slug ${riotSlug}.`)
    }

    appendMappedChampion(mapping, championId, entry)
    usedSlugs.add(riotSlug)
  }

  const riotEntriesByName = new Map<string, RiotChampionListEntry[]>()

  for (const entry of riotEntries) {
    if (usedSlugs.has(entry.riotSlug)) {
      continue
    }

    const normalizedName = normalizeChampionIdentityName(entry.title)
    const existingEntries = riotEntriesByName.get(normalizedName) ?? []
    existingEntries.push(entry)
    riotEntriesByName.set(normalizedName, existingEntries)
  }

  for (const [championId, champion] of Object.entries(champions)) {
    if (mapping[championId]) {
      continue
    }

    const normalizedName = normalizeChampionIdentityName(champion.displayName)
    const matches = riotEntriesByName.get(normalizedName) ?? []

    if (matches.length !== 1) {
      throw new Error(
        `Unable to map champion ${championId} (${champion.displayName}) to a unique Riot entry.`
      )
    }

    const [entry] = matches
    appendMappedChampion(mapping, championId, entry)
    usedSlugs.add(entry.riotSlug)
  }

  if (Object.keys(mapping).length !== Object.keys(champions).length) {
    throw new Error("Champion mapping does not cover the full local champion catalog.")
  }

  if (usedSlugs.size !== riotEntries.length) {
    const unmappedSlugs = riotEntries
      .filter((entry) => !usedSlugs.has(entry.riotSlug))
      .map((entry) => entry.riotSlug)

    throw new Error(`Riot champion list contains unmapped entries: ${unmappedSlugs.join(", ")}`)
  }

  return mapping
}
