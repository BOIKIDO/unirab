import { generateInsights } from '../lib/insights'

const JOB_ID = '375d566d-bff3-4f98-a0f2-f32de7c0efd9'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const h = { apikey: key, Authorization: `Bearer ${key}` }

  const [jobRes, compRes] = await Promise.all([
    fetch(`${url}/rest/v1/research_jobs?id=eq.${JOB_ID}&select=*`, { headers: h }),
    fetch(`${url}/rest/v1/competitors?job_id=eq.${JOB_ID}&select=competitor_name,mention_count&order=mention_count.desc`, { headers: h }),
  ])
  const [job] = await jobRes.json()
  const competitors = await compRes.json()

  // Use the GPT-detector results we computed earlier
  const chatgptMentions = 2
  const geminiMentions = 0
  const totalQueriesPerPlatform = (job.keywords?.length ?? 0) * 2

  const result = await generateInsights({
    businessName: job.business_name,
    city: job.location_city,
    state: job.location_state,
    primaryService: job.primary_service ?? '',
    scoreOverall: job.score_overall,
    scoreChatgpt: job.score_chatgpt,
    scoreGemini: job.score_gemini,
    chatgptMentions,
    geminiMentions,
    totalQueriesPerPlatform,
    keywords: job.keywords ?? [],
    topCompetitors: competitors.map((c: { competitor_name: string; mention_count: number }) => ({
      name: c.competitor_name,
      count: c.mention_count,
    })),
  })

  console.log('\n=== SUMMARY ===')
  console.log(result.summary)
  console.log('\n=== INSIGHTS ===')
  result.insights.forEach((i, n) => console.log(`${n + 1}. ${i}\n`))
  console.log('=== RECOMMENDATIONS ===')
  result.recommendations.forEach((r) => console.log(`${r.icon}. ${r.text}\n`))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
