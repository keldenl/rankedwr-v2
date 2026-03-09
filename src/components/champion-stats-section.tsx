import { format, parse, subDays } from "date-fns"
import { startTransition, useMemo, useState } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type {
  ChampionRoleStat,
  ChampionStatsBucket,
  ChampionStatsHistorySeries,
  LaneId,
} from "@/lib/tencent-lolm"

type TrendMetric = "rank" | "tier" | "winRate" | "pickRate" | "banRate"
type TimeRange = "all" | "7d" | "30d"

const METRIC_OPTIONS: { key: TrendMetric; label: string; color: string }[] = [
  { key: "rank", label: "Rank", color: "var(--chart-5)" },
  { key: "tier", label: "Tier", color: "var(--chart-3)" },
  { key: "winRate", label: "Win", color: "var(--chart-2)" },
  { key: "pickRate", label: "Pick", color: "var(--chart-1)" },
  { key: "banRate", label: "Ban", color: "var(--chart-4)" },
]

const TIME_RANGE_OPTIONS: { key: TimeRange; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
]

const TIER_VALUE_MAP = {
  F: 1,
  D: 2,
  C: 3,
  B: 4,
  A: 5,
  S: 6,
} as const

const TIER_LABEL_BY_VALUE = {
  1: "F",
  2: "D",
  3: "C",
  4: "B",
  5: "A",
  6: "S",
} as const

function parseStatDate(statDate: string) {
  return parse(statDate, "yyyyMMdd", new Date())
}

function formatMetricValue(metric: TrendMetric, value: number) {
  if (metric === "rank") {
    return `#${Math.round(value)}`
  }

  if (metric === "tier") {
    return TIER_LABEL_BY_VALUE[Math.round(value) as keyof typeof TIER_LABEL_BY_VALUE] ?? ""
  }

  return `${Math.round(value)}%`
}

function formatAxisLabel(statDate: string) {
  return format(parseStatDate(statDate), "MMM d")
}

function formatTooltipLabel(statDate: string) {
  return format(parseStatDate(statDate), "MMM d, yyyy")
}

function filterPointsByRange(
  points: ChampionStatsHistorySeries["points"],
  selectedRange: TimeRange
) {
  if (selectedRange === "all" || points.length === 0) {
    return points
  }

  const latestPoint = points[points.length - 1]

  if (!latestPoint) {
    return points
  }

  const latestDate = parseStatDate(latestPoint.statDate)
  const cutoffDate = subDays(latestDate, selectedRange === "7d" ? 6 : 29)

  return points.filter((point) => parseStatDate(point.statDate) >= cutoffDate)
}

function getWinRateDomain(values: number[]) {
  if (values.length === 0) {
    return [48, 52]
  }

  const center = 50
  const maxDeltaFromCenter = Math.max(
    ...values.map((value) => Math.abs(value - center)),
    1.5
  )
  const padding = Math.max(2, Math.ceil((maxDeltaFromCenter + 0.5) * 2) / 2)

  return [center - padding, center + padding]
}

function getRankDomain(values: number[]) {
  if (values.length === 0) {
    return [1, 2]
  }

  const minRank = Math.max(1, Math.min(...values))
  const maxRank = Math.max(...values)

  if (minRank === maxRank) {
    return [minRank, minRank + 1]
  }

  return [minRank, maxRank]
}

function getWholePercentTicks(minValue: number, maxValue: number) {
  const span = maxValue - minValue
  const step = span <= 4 ? 1 : span <= 10 ? 2 : 5
  const ticks: number[] = []

  for (let tick = minValue; tick <= maxValue; tick += step) {
    ticks.push(tick)
  }

  if (ticks[ticks.length - 1] !== maxValue) {
    ticks.push(maxValue)
  }

  return ticks
}

function getRateDomain(values: number[]) {
  if (values.length === 0) {
    return [0, 5]
  }

  const maxValue = Math.max(...values)

  return [0, Math.max(2, Math.ceil(maxValue + 1))]
}

function getAxisConfig(metric: TrendMetric, values: number[]) {
  if (metric === "rank") {
    const domain = getRankDomain(values)
    const ticks = getWholePercentTicks(domain[0], domain[1])

    return {
      allowDecimals: false,
      domain: [domain[0], domain[1]] as [number, number],
      reversed: true,
      tickCount: ticks.length,
      tickFormatter: (value: number) => `#${Math.round(value)}`,
      ticks,
    }
  }

  if (metric === "tier") {
    return {
      allowDecimals: false,
      domain: [1, 6] as [number, number],
      reversed: false,
      tickCount: 6,
      tickFormatter: (value: number) =>
        TIER_LABEL_BY_VALUE[Math.round(value) as keyof typeof TIER_LABEL_BY_VALUE] ?? "",
      ticks: [1, 2, 3, 4, 5, 6],
    }
  }

  if (metric === "winRate") {
    const domain = getWinRateDomain(values)
    const minValue = Math.floor(domain[0])
    const maxValue = Math.ceil(domain[1])

    return {
      allowDecimals: false,
      domain: [minValue, maxValue] as [number, number],
      reversed: false,
      tickCount: 5,
      tickFormatter: (value: number) => `${Math.round(value)}%`,
      ticks: getWholePercentTicks(minValue, maxValue),
    }
  }

  const domain = getRateDomain(values)
  const minValue = Math.floor(domain[0])
  const maxValue = Math.ceil(domain[1])

  return {
    allowDecimals: false,
    domain: [minValue, maxValue] as [number, number],
    reversed: false,
    tickCount: Math.min(6, maxValue - minValue + 1),
    tickFormatter: (value: number) => `${Math.round(value)}%`,
    ticks: getWholePercentTicks(minValue, maxValue),
  }
}

export function ChampionStatsSection({
  activeRoleStats,
  buckets,
  history,
  onLaneChange,
  selectedBucket,
  selectedLane,
  onBucketChange,
}: {
  activeRoleStats: ChampionRoleStat | null
  buckets: ChampionStatsBucket[]
  history: ChampionStatsHistorySeries[]
  onLaneChange: (lane: LaneId) => void
  selectedBucket: ChampionStatsBucket | null
  selectedLane: LaneId | null
  onBucketChange: (bucket: string) => void
}) {
  const [selectedMetric, setSelectedMetric] = useState<TrendMetric>("rank")
  const [selectedRange, setSelectedRange] = useState<TimeRange>("all")

  const activeSeries = useMemo(
    () =>
      history.find(
        (series) =>
          series.bucket === selectedBucket?.bucket &&
          series.lane === activeRoleStats?.lane
      ) ?? null,
    [activeRoleStats?.lane, history, selectedBucket?.bucket]
  )

  const metricOption =
    METRIC_OPTIONS.find((option) => option.key === selectedMetric) ?? METRIC_OPTIONS[0]
  const filteredPoints = useMemo(
    () => filterPointsByRange(activeSeries?.points ?? [], selectedRange),
    [activeSeries?.points, selectedRange]
  )
  const chartData = useMemo(
    () =>
      filteredPoints.map((point) => ({
        ...point,
        label: formatAxisLabel(point.statDate),
        tooltipLabel: formatTooltipLabel(point.statDate),
        value:
          selectedMetric === "rank"
            ? point.rank
            : selectedMetric === "tier"
            ? TIER_VALUE_MAP[point.strengthTier]
            : point[selectedMetric],
      })),
    [filteredPoints, selectedMetric]
  )
  const axisConfig = getAxisConfig(
    selectedMetric,
    chartData.map((point) => Number(point.value))
  )
  const hasTrendData = chartData.length > 0
  const hasEnoughPointsForTrend = chartData.length > 1

  return (
    <section className="rift-champion-trends-shell" aria-labelledby="champion-trends-title">
      <div className="rift-champion-trends-inner">
        <div className="rift-champion-trends-header">
          <div className="rift-champion-section-copy rift-champion-section-copy--inline">
            <h2 id="champion-trends-title" className="rift-champion-section-title">
              Stats History
            </h2>
          </div>

          <div className="rift-champion-trends-controls">
            <Select
              value={selectedLane ?? activeRoleStats?.lane ?? ""}
              onValueChange={(value) => onLaneChange(value as LaneId)}
            >
              <SelectTrigger
                size="sm"
                className="rift-champion-trends-select"
                aria-label="Stats history role"
              >
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {(selectedBucket?.roles ?? []).map((role) => (
                    <SelectItem key={role.lane} value={role.lane}>
                      {role.laneLabel}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select value={selectedBucket?.bucket ?? ""} onValueChange={onBucketChange}>
              <SelectTrigger
                size="sm"
                className="rift-champion-trends-select"
                aria-label="Stats history rank bucket"
              >
                <SelectValue placeholder="Rank bucket" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {buckets.map((bucket) => (
                    <SelectItem key={bucket.bucket} value={bucket.bucket}>
                      {bucket.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select
              value={selectedRange}
              onValueChange={(value) => setSelectedRange(value as TimeRange)}
            >
              <SelectTrigger
                size="sm"
                className="rift-champion-trends-select"
                aria-label="Stats history date range"
              >
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {TIME_RANGE_OPTIONS.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rift-champion-trends-card">
          <div className="rift-champion-trends-toolbar">
            <ToggleGroup
              type="single"
              value={selectedMetric}
              onValueChange={(value) => {
                if (!value) {
                  return
                }

                startTransition(() => {
                  setSelectedMetric(value as TrendMetric)
                })
              }}
              variant="outline"
              spacing={1}
              className="rift-champion-trends-toggle"
              aria-label="Champion stat trend metric"
            >
              {METRIC_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.key}
                  value={option.key}
                  className="rift-champion-trends-toggle-item"
                  aria-label={option.label}
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div className="rift-champion-trends-meta">
              {activeRoleStats ? (
                <p className="rift-champion-trends-current-value">
                  {metricOption.label}: {formatMetricValue(
                    selectedMetric,
                    selectedMetric === "tier"
                      ? TIER_VALUE_MAP[activeRoleStats.strengthTier]
                      : selectedMetric === "rank"
                        ? activeRoleStats.rank
                      : activeRoleStats[selectedMetric]
                  )}
                </p>
              ) : null}
            </div>
          </div>

          {hasTrendData ? (
            <>
              <ChartContainer
                config={{
                  value: {
                    color: metricOption.color,
                    label: metricOption.label,
                  },
                }}
                className="rift-champion-trends-chart"
              >
                <LineChart
                  data={chartData}
                  margin={{ top: 12, right: 8, left: 18, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="2 6" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    minTickGap={20}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    ticks={axisConfig.ticks}
                    reversed={axisConfig.reversed}
                    allowDecimals={axisConfig.allowDecimals}
                    domain={axisConfig.domain}
                    tickCount={axisConfig.tickCount}
                    tickFormatter={axisConfig.tickFormatter}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => payload?.[0]?.payload.tooltipLabel ?? ""}
                        formatter={(value) => (
                          <div className="flex w-full items-center justify-between gap-3">
                            <span className="text-muted-foreground">{metricOption.label}</span>
                            <span className="font-mono font-medium text-foreground tabular-nums">
                              {formatMetricValue(selectedMetric, Number(value))}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-value)"
                    strokeWidth={2.25}
                    dot={{
                      fill: "var(--color-value)",
                      r: 2.75,
                      strokeWidth: 0,
                    }}
                    activeDot={{
                      fill: "var(--color-value)",
                      r: 4,
                      stroke: "var(--background)",
                      strokeWidth: 2,
                    }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ChartContainer>

              {!hasEnoughPointsForTrend ? (
                <p className="rift-champion-trends-note">
                  Trend history is still accumulating for this role and rank bucket.
                </p>
              ) : null}
            </>
          ) : (
            <p className="rift-champion-trends-note">
              Trend history is not available for this role and rank bucket yet.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
