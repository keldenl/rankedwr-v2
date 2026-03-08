export type ChampionStrengthTier = "S" | "A" | "B" | "C" | "D" | "F"

const PERCENT_SCALE = 100
const BAN_AND_PICK_WEIGHT = 5

const STRENGTH_TIER_THRESHOLDS: Array<{
  minimumScore: number
  tier: ChampionStrengthTier
}> = [
  { minimumScore: 58, tier: "S" },
  { minimumScore: 54, tier: "A" },
  { minimumScore: 52, tier: "B" },
  { minimumScore: 48, tier: "C" },
  { minimumScore: 46, tier: "D" },
  { minimumScore: 40, tier: "F" },
]

function toPercentDecimal(value: number) {
  return value / PERCENT_SCALE
}

export function calculateChampionStrengthScore(
  winRate: number,
  pickRate: number,
  banRate: number
) {
  const normalizedWinRate = toPercentDecimal(winRate)
  const normalizedPickRate = toPercentDecimal(pickRate)
  const normalizedBanRate = toPercentDecimal(banRate)

  return (
    (normalizedWinRate +
      (normalizedWinRate * normalizedPickRate) / BAN_AND_PICK_WEIGHT +
      (normalizedWinRate * normalizedBanRate) / BAN_AND_PICK_WEIGHT) *
    PERCENT_SCALE
  )
}

export function getChampionStrengthTier(
  strengthScore: number
): ChampionStrengthTier {
  const matchedTier = STRENGTH_TIER_THRESHOLDS.find(
    ({ minimumScore }) => strengthScore >= minimumScore
  )

  return matchedTier?.tier ?? "F"
}
