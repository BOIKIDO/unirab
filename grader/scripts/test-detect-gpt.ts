import { detectMentionGPT } from '../lib/parser'

const JOB_ID = '375d566d-bff3-4f98-a0f2-f32de7c0efd9'
const BUSINESS = 'Hoboken General Contractor'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const res = await fetch(
    `${url}/rest/v1/query_results?job_id=eq.${JOB_ID}&select=platform,keyword,location_type,response_text`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  )
  const rows: Array<{ platform: string; keyword: string; location_type: string; response_text: string }> =
    await res.json()

  console.log(`\nRe-running GPT detector against ${rows.length} stored responses for "${BUSINESS}"\n`)

  const t0 = Date.now()
  const results = await Promise.all(
    rows.map(async (r) => {
      const m = await detectMentionGPT(r.response_text ?? '', BUSINESS)
      return { ...r, m }
    })
  )
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

  let cgHits = 0, gmHits = 0
  for (const r of results) {
    if (r.m.mentioned) {
      console.log(`  ✓ ${r.platform}/${r.location_type}/${r.keyword} — count=${r.m.mentionCount} firstMention=${r.m.isFirstMention}`)
      if (r.platform === 'chatgpt') cgHits++
      else if (r.platform === 'gemini') gmHits++
    }
  }
  console.log(`\nChatGPT hits: ${cgHits}/${results.filter(r=>r.platform==='chatgpt').length}`)
  console.log(`Gemini hits:  ${gmHits}/${results.filter(r=>r.platform==='gemini').length}`)
  console.log(`Elapsed: ${elapsed}s`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
