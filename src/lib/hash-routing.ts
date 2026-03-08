export const HOME_ROUTE = "/" as const
export const LEADERBOARDS_ROUTE = "/leaderboards" as const

export type AppRoute = typeof HOME_ROUTE | typeof LEADERBOARDS_ROUTE

export function routeToHash(route: AppRoute) {
  return route === LEADERBOARDS_ROUTE ? "#/leaderboards" : "#/"
}

export function routeFromHash(hash: string) {
  const normalizedHash = hash.replace(/^#/, "") || "/"
  const normalizedRoute = normalizedHash.startsWith("/")
    ? normalizedHash
    : `/${normalizedHash}`

  return normalizedRoute === LEADERBOARDS_ROUTE ? LEADERBOARDS_ROUTE : HOME_ROUTE
}

export function buildRouteUrl(route: AppRoute, params?: URLSearchParams) {
  const nextSearch = params?.toString()
  const search = nextSearch ? `?${nextSearch}` : ""
  return `${window.location.pathname}${search}${routeToHash(route)}`
}

export function replaceRouteSearch(route: AppRoute, params: URLSearchParams) {
  window.history.replaceState(null, "", buildRouteUrl(route, params))
}
