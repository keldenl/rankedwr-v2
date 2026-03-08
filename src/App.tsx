import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-slate-100">
      <section className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-sky-950/30 backdrop-blur">
        <div className="mb-8 space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-300">
            Tailwind CSS is active
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Vite + React + Tailwind
          </h1>
          <p className="max-w-xl text-base text-slate-300 sm:text-lg">
            The project now uses the official Tailwind Vite plugin and utility
            classes directly in React components.
          </p>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-sky-400/20 bg-slate-950/40 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-400">Interactive check</p>
            <p className="text-2xl font-semibold">{count}</p>
          </div>
          <button
            className="rounded-xl bg-sky-400 px-4 py-3 font-medium text-slate-950 transition hover:bg-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:ring-offset-2 focus:ring-offset-slate-950"
            onClick={() => setCount((count) => count + 1)}
          >
            Increment counter
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            `@import "tailwindcss"`
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            `@tailwindcss/vite`
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            utility classes in `App.tsx`
          </span>
        </div>
      </section>
    </main>
  )
}

export default App
