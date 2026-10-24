import { analyzeResponse, aggregateCompetitors } from '../lib/parser'

const JOB_ID = '375d566d-bff3-4f98-a0f2-f32de7c0efd9'
const BUSINESS = 'Hoboken General Contractor'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const res = await fetch(
    `${url}/rest/v1/query_results?job_id=eq.${JOB_ID}&select=response_text`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  )
  const rows: Array<{ response_text: string }> = await res.json()
  console.log(`Analyzing ${rows.length} responses…`)

  const t0 = Date.now()
  const analyses = await Promise.all(
    rows.map((r) => analyzeResponse(r.response_text ?? '', BUSINESS))
  )
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

  const perResponseCompetitors = analyses.map((a) => a.competitors)
  const totalCompetitorMentions = perResponseCompetitors.reduce((s, c) => s + c.length, 0)
  console.log(`Extracted ${totalCompetitorMentions} raw competitor mentions across ${rows.length} responses in ${elapsed}s\n`)

  const top10 = aggregateCompetitors(perResponseCompetitors).slice(0, 10)
  console.log('=== TOP 10 COMPETITORS (deduped, normalized) ===')
  top10.forEach((c, i) => console.log(`  ${(i + 1).toString().padStart(2)}. ${c.name.padEnd(40)} ${c.count}`))
}

main().catch((e) => { console.error(e); process.exit(1) })
