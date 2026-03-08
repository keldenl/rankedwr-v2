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
      <a href="#/" className="rift-wordmark rift-wordmark--sm">
        RankedWR
      </a>
      {rightContent ?? <div />}
    </header>
  )
}
