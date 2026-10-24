import { detectMention } from '../lib/parser'

const JOB_ID = '050fb5d3-e66f-437d-8d95-29dd3deb917e'
const BUSINESS = 'Hoboken General Contractor'
const KNOWN = 'KBR Design & Build'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const res = await fetch(
    `${url}/rest/v1/query_results?job_id=eq.${JOB_ID}&select=platform,keyword,location_type,response_text`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  )
  const rows: Array<{ platform: string; keyword: string; location_type: string; response_text: string }> =
    await res.json()

  if (!rows?.length) {
    console.log('No rows found for job', JOB_ID)
    return
  }

  console.log(`\nTesting detector against ${rows.length} stored responses for: "${BUSINESS}"\n`)

  let hits = 0
  let totalChars = 0
  const positives: string[] = []

  for (const r of rows) {
    totalChars += r.response_text?.length ?? 0
    const result = detectMention(r.response_text ?? '', BUSINESS)
    if (result.mentioned) {
      hits++
      positives.push(`  ✓ ${r.platform}/${r.location_type}/${r.keyword} — count=${result.mentionCount}`)
    }
  }

  console.log(`Total response text: ${totalChars} chars`)
  console.log(`Mentions detected: ${hits}/${rows.length}\n`)

  if (positives.length) {
    console.log('Positive matches:')
    positives.forEach((p) => console.log(p))
  }

  // Sanity check
  let knownHits = 0
  for (const r of rows) {
    const result = detectMention(r.response_text ?? '', KNOWN)
    if (result.mentioned) knownHits++
  }
  console.log(`\nSanity check — searching for "${KNOWN}": ${knownHits}/${rows.length} responses contain it`)

  // Raw substring check
  let rawHits = 0
  for (const r of rows) {
    if ((r.response_text ?? '').toLowerCase().includes('hoboken general')) rawHits++
  }
  console.log(`Raw substring "hoboken general": ${rawHits}/${rows.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
