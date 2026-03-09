# rankedwr

Static Wild Rift champion win rates and tier-list site built with Bun, Vite, and React.

## Development

```bash
bun install
bun run dev
```

## Scripts

- `bun run dev` starts the Vite dev server
- `bun run build` builds the app and prerenders static pages
- `bun run lint` runs ESLint
- `bun run sync:data` refreshes the static data files

## Analytics

Cloudflare Web Analytics is wired into the live Vite entrypoint at `/index.html`. It stays disabled unless a token is present.

### Local

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN` to your Cloudflare Web Analytics token.
3. Run `bun run dev` or `bun run build`.

`.env.local` is ignored by git, so the token stays on your machine. If the variable is missing, analytics stays off.

### GitHub Pages

1. Open the repo on GitHub.
2. Go to `Settings` -> `Secrets and variables` -> `Actions`.
3. Add a new repository secret named `CLOUDFLARE_WEB_ANALYTICS_TOKEN`.
4. Paste the same token there.

The deploy workflow reads that secret during the `bun run build` step, so production builds include the analytics beacon without committing the token to the repo.

With the token configured, Cloudflare will collect SPA pageviews for the existing routes:

- `/`
- `/tier-list/`
- `/champions/`
- `/champion/:slug/`

Search terms and other custom events are intentionally not tracked in v1.
