import { redirect } from 'next/navigation'
import ScoreGauge from '@/components/report/ScoreGauge'
import CompetitorList from '@/components/report/CompetitorList'
import KeywordMatrix from '@/components/report/KeywordMatrix'
import Recommendations from '@/components/report/Recommendations'
import ReportCta from '@/components/report/ReportCta'
import SequenceCta from '@/components/report/SequenceCta'
import { scoreGrade } from '@/lib/scoring'
import { fetchReportData } from '@/lib/report'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ReportPage({ params }: Props) {
  const { id } = await params
  const data = await fetchReportData(id)

  if (!data.success) {
    if (data.data?.status === 'pending' || data.data?.status === 'running') {
      redirect(`/research/${id}/progress`)
    }
    return (
      <main className="bg-white min-h-screen flex items-center justify-center">
        <p className="text-[#5d6d6a] text-lg">Report not found.</p>
      </main>
    )
  }

  const { job, competitors, queryResults, lead } = data.data
  const { label: scoreLabel } = scoreGrade(job.score_overall)
  const businessMentions = queryResults.filter((r) => r.mentioned).length
  const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3003'}/research/${id}`

  return (
    <main className="bg-white min-h-screen">
      {/* Nav */}
      <nav className="bg-white border-b border-black/[0.06] px-4 md:px-12 py-4 md:py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
<span className="inline-flex items-baseline" style={{fontStyle:'italic', fontWeight:900, fontSize:26, letterSpacing:'-1.2px', color:'#102a2a'}}>UNI<span style={{color:'#ff735d'}}>RAB</span><span style={{color:'#ff735d', fontSize:'0.72em', verticalAlign:'super'}}>&bull;</span></span>
          <a
            href={process.env.NEXT_PUBLIC_CALENDLY_URL ?? '#'}
            className="bg-[#ff735d] text-[#1d2423] font-bold px-4 py-2 md:px-5 md:py-2.5 rounded-full text-xs md:text-sm hover:bg-[#ff846f] transition-all"
          >
            Book a Free Call
          </a>
        </div>
      </nav>

      {/* Score section — full-width Nardo Gray background, the hero of the report */}
      <ScoreGauge
        score={job.score_overall}
        scoreLabel={scoreLabel}
        chatgptScore={job.score_chatgpt}
        geminiScore={job.score_gemini}
        businessName={job.business_name}
        primaryService={job.primary_service ?? ''}
        city={job.location_city}
        state={job.location_state}
        description={job.description_text}
        descriptionCategory={job.description_category}
      />

      {/* Who's beating you — simplified competitor view */}
      <section className="px-4 md:px-12 lg:px-20 py-8 md:py-10">
        <div className="max-w-6xl mx-auto">
          <CompetitorList
            competitors={competitors}
            businessName={job.business_name}
            businessMentions={businessMentions}
          />
        </div>
      </section>

      {/* How to fix this — recommendations & insights */}
      <Recommendations
        jobId={id}
        score={job.score_overall}
        businessName={job.business_name}
        city={job.location_city}
        state={job.location_state}
        topCompetitor={competitors[0]?.competitor_name}
        chatgptMentions={queryResults.filter((r) => r.platform === 'chatgpt' && r.mentioned).length}
        geminiMentions={queryResults.filter((r) => r.platform === 'gemini' && r.mentioned).length}
        totalQueries={queryResults.length}
        summary={job.insights_summary}
        insights={(job.insights_data as Record<string, unknown> | null)?.insights as string[] | null}
        recommendations={(job.insights_data as Record<string, unknown> | null)?.recommendations as Array<{ icon: string; text: string }> | null}
      />

      {/* Trust bar — social proof for American market */}
      <div className="bg-[#FAFAF7] border-y border-black/[0.05] px-4 py-5 text-center">
        <p className="text-[#5d6d6a] text-[13px]">
          <span className="text-[#102a2a] font-black">200+ contractors</span> across the U.S. have checked their AI visibility with Faaxa.
          Roofers, plumbers, electricians, and HVAC teams in 1,400+ cities.
        </p>
      </div>

      {/* Keyword matrix */}
      <KeywordMatrix
        keywords={job.keywords}
        queryResults={queryResults}
        city={job.location_city}
        state={job.location_state}
      />

      {/* 5-Day Fix Plan — bridge offer (only for lead-captured users) */}
      {lead && (
        <section className="bg-white py-8 px-4 md:px-12 lg:px-20">
          <div className="max-w-4xl mx-auto">
            <SequenceCta
              jobId={id}
              email={lead.email}
              businessName={job.business_name}
              alreadyEnrolled={lead.sequence_enrolled}
            />
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      <ReportCta score={job.score_overall} />

      {/* Share row */}
      <div className="bg-white border-t border-black/[0.06] px-4 py-6">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-[#8a9694] text-[11px] font-semibold mb-3">Share this report</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-[#0A66C2] text-white rounded-full px-4 py-2 text-xs font-semibold hover:bg-[#004182] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
              Share on LinkedIn
            </a>
            <a
              href={`mailto:?subject=Our%20AI%20visibility%20score%20for%20${encodeURIComponent(job.business_name)}&body=Check%20out%20our%20free%20AI%20visibility%20report%20from%20Faaxa%3A%20${encodeURIComponent(shareUrl)}`}
              className="inline-flex items-center gap-1.5 bg-white border border-black/[0.08] rounded-full px-4 py-2 text-[#102a2a] text-xs font-semibold hover:bg-gray-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              Email Report
            </a>
          </div>
        </div>
      </div>

      {/* Report footer */}
      <div className="bg-white border-t border-black/[0.06] px-4 py-4 text-center">
        <p className="text-[#8a9694] text-[10px]">
          Report for {job.business_name} in {job.location_city}, {job.location_state} · Generated {new Date(job.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · AI Visibility Grader by Faaxa
        </p>
      </div>
    </main>
  )
}
