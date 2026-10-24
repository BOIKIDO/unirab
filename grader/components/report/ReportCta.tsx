function getTier(score: number) {
  if (score <= 20) return { name: 'Dead in the Water', urgency: 'critical' }
  if (score <= 40) return { name: 'Bleeding Out', urgency: 'critical' }
  if (score <= 60) return { name: 'Treading Water', urgency: 'high' }
  if (score <= 75) return { name: 'In the Game', urgency: 'medium' }
  if (score <= 90) return { name: 'Market Contender', urgency: 'low' }
  return { name: 'Category King', urgency: 'low' }
}

interface Props {
  score: number
}

const CTA_BY_URGENCY: Record<string, { headline: string; subtext: string; button: string }> = {
  critical: {
    headline: 'Every Day At This Score Is A Day Your Competitors Get Your Jobs.',
    subtext: 'Your business is invisible to AI. That means invisible to the homeowners searching for you right now. We fix this in 90 days. No fluff. No empty promises. Just the specific changes that make ChatGPT and Gemini recommend you first.',
    button: 'Get a Free AI Visibility Fix Plan',
  },
  high: {
    headline: 'You\'re In The Game. But You\'re Not Winning Yet.',
    subtext: 'AI mentions you sometimes, but your competitors get named more. Every month without action widens the gap. We know exactly which levers move the score. Let\'s build your AI presence before your position gets worse.',
    button: 'Get a Free AI Visibility Fix Plan',
  },
  medium: {
    headline: 'Good Isn\'t Locked In. One Competitor Can Take Your Spot In 90 Days.',
    subtext: 'You\'re getting recommended, but the lead isn\'t safe. AI visibility compounds: the businesses AI cites most get cited even more. Lock in your position before someone pushes you out.',
    button: 'Lock In Your AI Position: Free Strategy Call',
  },
  low: {
    headline: 'You\'re Ahead. Now Let\'s Make It Impossible To Catch You.',
    subtext: 'AI sends homeowners your way, and there\'s more market to capture. Expand to neighboring cities. Add platforms. Build a moat so wide no competitor crosses it. Let\'s plan the next move.',
    button: 'Plan Your Expansion: Free Strategy Call',
  },
}

export default function ReportCta({ score }: Props) {
  const tier = getTier(score)
  const cta = CTA_BY_URGENCY[tier.urgency]

  return (
    <section className="bg-[#102a2a] py-14 md:py-24 px-4 md:px-12 lg:px-20">
      <div className="max-w-4xl mx-auto text-center">
        <p className="text-[#ff735d] text-[10px] md:text-xs font-normal tracking-[0.24em] uppercase mb-4 md:mb-6">Ready to Fix This?</p>
        <h2 className="font-black text-2xl md:text-5xl text-white tracking-[-0.02em] leading-tight mb-3 md:mb-4">
          {cta.headline}
        </h2>
        <p className="text-white/60 text-sm md:text-lg mb-6 md:mb-10 max-w-xl mx-auto leading-relaxed">
          {cta.subtext}
        </p>

        <a
          href={process.env.NEXT_PUBLIC_CALENDLY_URL ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-[#ff735d] text-[#1d2423] font-bold px-8 md:px-10 py-3.5 md:py-4 rounded-xl hover:bg-[#ff846f] active:scale-[0.97] transition-all duration-200 text-base md:text-lg shadow-[var(--shadow-glow)]"
        >
          {cta.button}
          <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </a>

        <p className="text-white/40 text-xs md:text-sm mt-3 md:mt-4">Free 20-minute call. No pitch. Just strategy.</p>
      </div>
    </section>
  )
}
