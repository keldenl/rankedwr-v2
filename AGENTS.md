# Repo Notes

- Use Bun for all package management and script execution in this repo.
- Prefer `bun install`, `bun add`, `bun remove`, `bun run <script>`, and `bunx <tool>`.
- Do not use `npm`, `npx`, `pnpm`, or `yarn` unless the user explicitly asks.

# UI Notes

- Keep the landing page dead simple.
- Prefer existing shadcn components over custom styled markup.
- Avoid decorative gradients, glassmorphism, oversized cards, and filler copy unless the user asks for them.
- For this app, the default target is a plain search-focused page for Wild Rift champion win rates.

# Verification

- Use `bun run build` and `bun run lint` before wrapping up.
- If browser validation is needed, prefer the installed `agent-browser` skill after restarting Codex.
