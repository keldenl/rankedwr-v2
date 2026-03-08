import { syncRiotChampionPages } from "./sync-riot-champion-pages"
import { syncStaticData } from "./sync-tencent-lolm"

async function main() {
  const tencentSummary = await syncStaticData()
  const riotSummary = await syncRiotChampionPages()

  console.log(
    `SYNC_SUMMARY ${JSON.stringify({
      riot: riotSummary,
      tencent: tencentSummary,
    })}`
  )
}

if (import.meta.main) {
  await main()
}
