import { HOME_ROUTE, routeToHash } from "@/lib/hash-routing"

type SiteHeaderProps = {
  rightLabel?: string
  rightHref?: string
}

export function SiteHeader({ rightLabel, rightHref }: SiteHeaderProps) {
  const rightContent = rightLabel ? (
    rightHref ? (
      <a href={rightHref} className="rift-topbar-link rift-topbar-link--action">
        {rightLabel}
      </a>
    ) : (
      <div className="rift-topbar-link rift-topbar-link--action">{rightLabel}</div>
    )
  ) : null

  return (
    <header className="rift-topbar">
      <a href={routeToHash(HOME_ROUTE)} className="rift-wordmark rift-wordmark--sm">
        <span className="rift-wordmark-ranked">Ranked</span>
        <span className="rift-wordmark-wr">WR</span>
      </a>
      {rightContent ?? <div />}
    </header>
  )
}
