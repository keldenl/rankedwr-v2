import { describe, expect, test } from "bun:test"

import {
  calculateChampionStrengthScore,
  getChampionStrengthTier,
} from "../src/lib/champion-strength"

describe("champion strength", () => {
  test("matches the legacy score formula using percentage inputs", () => {
    expect(calculateChampionStrengthScore(57.4, 0.14, 1.05)).toBeCloseTo(57.54, 2)
  })

  test("maps scores into legacy strength tiers", () => {
    expect(getChampionStrengthTier(58)).toBe("S")
    expect(getChampionStrengthTier(54)).toBe("A")
    expect(getChampionStrengthTier(52)).toBe("B")
    expect(getChampionStrengthTier(48)).toBe("C")
    expect(getChampionStrengthTier(46)).toBe("D")
    expect(getChampionStrengthTier(39.99)).toBe("F")
  })
})
