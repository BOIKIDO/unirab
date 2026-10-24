'use client'

export default function ClosingCta() {
  return (
    <section className="bg-white py-24 md:py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
      <div className="max-w-4xl mx-auto text-center">
        <p className="text-[#8a6a00] text-xs font-normal tracking-[0.24em] uppercase mb-5">Don&apos;t Lose Jobs to a Competitor</p>
        <h2 className="font-black text-2xl sm:text-3xl md:text-5xl text-[#111827] tracking-[-0.02em] leading-[1.1] mb-5">
          Find out if AI is sending <span className="text-[#F5C518]">your customers elsewhere.</span>
        </h2>
        <p className="text-[#374151] font-semibold text-[15px] md:text-lg mb-6 max-w-xl mx-auto leading-relaxed">
          Join 200+ contractors who discovered their AI visibility score. The average is <span className="font-black text-[#111827]">41</span> out of <span className="font-black text-[#F5C518]">100</span>. Where do you land?
        </p>
        <p className="text-[#6B7280] text-base md:text-lg mb-9 max-w-xl mx-auto leading-relaxed">
          Your free report takes 90 seconds and shows exactly where you stand, and which competitors are winning the calls you should be getting.
        </p>
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          className="inline-flex items-center gap-2 bg-[#F5C518] text-black font-bold px-10 py-4 rounded-xl hover:bg-yellow-400 hover:scale-[1.02] active:scale-[0.97] transition-all duration-200 text-lg shadow-[var(--shadow-glow)]"
        >
          Run My Free Report
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </a>
        <p className="text-[#9CA3AF] text-sm mt-4">No credit card. No obligation. 100% free.</p>
      </div>
    </section>
  )
}
