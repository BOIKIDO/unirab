import Hero from '@/components/landing/Hero'
import ProblemSection from '@/components/landing/ProblemSection'
import HowItWorks from '@/components/landing/HowItWorks'
import WhyItMatters from '@/components/landing/WhyItMatters'
import FaqSection from '@/components/landing/FaqSection'
import ClosingCta from '@/components/landing/ClosingCta'

export default function HomePage() {
  return (
    <main>
      <Hero />
      <ProblemSection />
      <HowItWorks />
      <WhyItMatters />
      <FaqSection />
      <ClosingCta />
    </main>
  )
}
