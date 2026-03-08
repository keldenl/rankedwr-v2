import { startTransition, useEffect, useState } from "react"
import { ArrowRight, Search, Twitter } from "lucide-react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { LeaderboardsPage } from "@/components/leaderboards-page"
import {
  LEADERBOARDS_ROUTE,
  buildRouteUrl,
  routeFromHash,
  routeToHash,
} from "@/lib/hash-routing"

const smolderBackdropUrl =
  "https://cmsassets.rgpub.io/sanity/files/dsfx7636/game_data_live/937095edeaa81ee72125de2210982a1cf96325d5.mp4?accountingTag=WR"

function HomePage({
  initialQuery,
  onSearch,
}: {
  initialQuery: string
  onSearch: (query: string) => void
}) {
  const [searchQuery, setSearchQuery] = useState(initialQuery)

  useEffect(() => {
    setSearchQuery(initialQuery)
  }, [initialQuery])

  return (
    <main className="rift-home-page rift-home-video-shell">
      <a href="#home-content" className="skip-link">
        Skip to content
      </a>

      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="rift-home-video"
        aria-hidden="true"
      >
        <source src={smolderBackdropUrl} type="video/mp4" />
      </video>

      <div className="rift-home-overlay" aria-hidden="true" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <section
          id="home-content"
          className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 pb-4 pt-10 text-center"
        >
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full space-y-8">
              <div className="space-y-3">
                <h1 className="rift-wordmark rift-wordmark--hero">RankedWR</h1>
                <p className="rift-home-subtitle">
                  Wild Rift champion win rates.
                </p>
              </div>

              <div className="mx-auto w-full max-w-2xl space-y-3">
                <form
                  className="min-w-0 flex-1"
                  onSubmit={(event) => {
                    event.preventDefault()
                    onSearch(searchQuery)
                  }}
                >
                  <InputGroup className="rift-home-search h-14">
                    <InputGroupInput
                      id="champion-search"
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search champion"
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="Champion search"
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="submit"
                        variant="default"
                        size="icon-sm"
                        className="rift-search-submit rift-search-submit--solid"
                        aria-label="Search"
                      >
                        <Search />
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </form>

                <div className="flex justify-end">
                  <a href={routeToHash(LEADERBOARDS_ROUTE)} className="rift-inline-cta">
                    View leaderboards
                    <ArrowRight className="size-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          <footer className="rift-home-footer">
            <p>
              All data sourced from Riot&apos;s official{" "}
              <a
                href="https://lolm.qq.com/act/a20220818raider/index.html"
                target="_blank"
                rel="noreferrer"
                className="rift-footer-link"
              >
                Wild Rift CN Dia+ Statistics
              </a>{" "}
              and{" "}
              <a
                href="https://wildrift.leagueoflegends.com/en-us/champions/"
                target="_blank"
                rel="noreferrer"
                className="rift-footer-link"
              >
                champions list
              </a>
              .
            </p>
            <p>
              Built by{" "}
              <a
                href="https://twitter.com/RepotedWR"
                target="_blank"
                rel="noreferrer"
                className="rift-footer-link inline-flex items-center gap-1"
              >
                <Twitter className="size-3.5" />
                RepotedWR
              </a>{" "}
              © 2026
            </p>
          </footer>
        </section>
      </div>
    </main>
  )
}

function App() {
  const [locationState, setLocationState] = useState(() => ({
    hash: window.location.hash,
    search: window.location.search,
  }))

  useEffect(() => {
    function syncLocationState() {
      setLocationState({
        hash: window.location.hash,
        search: window.location.search,
      })
    }

    window.addEventListener("hashchange", syncLocationState)
    window.addEventListener("popstate", syncLocationState)

    return () => {
      window.removeEventListener("hashchange", syncLocationState)
      window.removeEventListener("popstate", syncLocationState)
    }
  }, [])

  const route = routeFromHash(locationState.hash)
  const initialQuery = new URLSearchParams(locationState.search).get("q") ?? ""

  function handleHomeSearch(query: string) {
    const nextParams = new URLSearchParams()

    if (query.trim()) {
      nextParams.set("q", query.trim())
    }

    const nextUrl = buildRouteUrl(LEADERBOARDS_ROUTE, nextParams)
    window.history.pushState(null, "", nextUrl)

    startTransition(() => {
      setLocationState({
        hash: routeToHash(LEADERBOARDS_ROUTE),
        search: nextParams.toString() ? `?${nextParams.toString()}` : "",
      })
    })
  }

  if (route === LEADERBOARDS_ROUTE) {
    return <LeaderboardsPage />
  }

  return <HomePage initialQuery={initialQuery} onSearch={handleHomeSearch} />
}

export default App
