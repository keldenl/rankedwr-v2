import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { LeaderboardsPage } from "@/components/leaderboards-page"

const smolderBackdropUrl =
  "https://cmsassets.rgpub.io/sanity/files/dsfx7636/game_data_live/937095edeaa81ee72125de2210982a1cf96325d5.mp4?accountingTag=WR"

function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 size-full object-cover"
        aria-hidden="true"
      >
        <source src={smolderBackdropUrl} type="video/mp4" />
      </video>

      <div className="absolute inset-0 bg-black/45" />

      <section className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-xl">
          <div className="mb-8 flex flex-col items-center text-center">
            <Badge variant="secondary" className="mb-4">
              Live CN data
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              RankedWR
            </h1>
            <p className="mt-2 max-w-md text-sm text-white/80">
              Search Wild Rift champion win rates and jump into the raw Tencent
              leaderboard feed.
            </p>
          </div>

          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="champion-search" className="sr-only">
                Champion name
              </FieldLabel>
              <Input
                id="champion-search"
                type="search"
                name="champion"
                placeholder="Champion name…"
                autoComplete="off"
                spellCheck={false}
                aria-label="Champion name"
                className="h-12 rounded-xl border-white/20 bg-white/92 text-black placeholder:text-black/45"
              />
            </Field>
          </FieldGroup>

          <div className="mt-4 flex items-center justify-center gap-3">
            <Button size="lg" asChild>
              <a href="/leaderboards">Browse leaderboards</a>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <a href="https://lolm.qq.com/act/a20220818raider/index.html" target="_blank" rel="noreferrer">
                Source site
              </a>
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}

function App() {
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/"

  if (pathname === "/leaderboards") {
    return <LeaderboardsPage />
  }

  return <HomePage />
}

export default App
