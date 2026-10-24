import { getSupabaseAdmin } from '../lib/supabase'

const JOB_ID = process.argv[2]
if (!JOB_ID) { console.error('usage: audit-db.ts <job_id>'); process.exit(1) }

async function main() {
  const sb = getSupabaseAdmin()

  const { data: job, error: jobErr } = await sb.from('research_jobs').select('*').eq('id', JOB_ID).single()
  console.log('JOB:', jobErr ?? job)

  const { data: comps, error: compErr, count } = await sb.from('competitors').select('*', { count: 'exact' }).eq('job_id', JOB_ID)
  console.log(`\nCOMPETITORS (${count} rows):`, compErr ?? comps)

  const { data: qrs, error: qrErr, count: qrCount } = await sb.from('query_results').select('platform,keyword,location_type,mentioned,mention_count', { count: 'exact' }).eq('job_id', JOB_ID)
  console.log(`\nQUERY_RESULTS (${qrCount} rows):`, qrErr ?? qrs)
}
main().catch((e) => { console.error(e); process.exit(1) })
