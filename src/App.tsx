import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const smolderBackdropUrl =
  "https://cmsassets.rgpub.io/sanity/files/dsfx7636/game_data_live/937095edeaa81ee72125de2210982a1cf96325d5.mp4?accountingTag=WR"

function App() {
  return (
    <main className="relative min-h-screen overflow-hidden">
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
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              RankedWR
            </h1>
            <p className="mt-2 text-sm text-white/80">
              Search Wild Rift champion win rates.
            </p>
          </div>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="champion-search" className="sr-only">
                Champion name
              </FieldLabel>
              <Input
                id="champion-search"
                type="search"
                name="champion"
                placeholder="Champion name"
                autoComplete="off"
                spellCheck={false}
                aria-label="Champion name"
                className="h-12 rounded-xl border-white/20 bg-white/92 text-black placeholder:text-black/45"
              />
            </Field>
          </FieldGroup>
        </div>
      </section>
    </main>
  )
}

export default App
