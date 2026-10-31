import { useEffect, useState } from 'react'
import Header from '@landing/components/layout/Header'
import Footer from '@landing/components/layout/Footer'
import { HeroSection } from '@landing/components/sections/hero/HeroSection'
import { PartnersSection } from '@landing/components/sections/partners/PartnersSection'
import { TeamSection } from '@landing/components/sections/team/TeamSection'
import { LandingGrindersPlaque } from '@landing/components/sections/product/LandingGrindersPlaque'
import { GraiFlowSection } from '@landing/components/sections/product/GraiFlowSection'
import { GraiExitFlowSection } from '@landing/components/sections/product/GraiExitFlowSection'
import { AnnualResultsSection } from '@landing/components/sections/results/AnnualResultsSection'
import { InvestmentPathsSection } from '@landing/components/sections/invest/InvestmentPathsSection'
import '@landing/landing.css'

/** Tailwind `md` — only one grinders plaque mount at a time. */
function useIsMdUp() {
  const [isMdUp, setIsMdUp] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => setIsMdUp(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isMdUp
}

export default function LandingPage() {
  const isMdUp = useIsMdUp()

  return (
    <div className="landing-root flex flex-col min-h-screen bg-[#e8e8e8] dark:bg-black">
      <Header />
      <div className="flex-1 relative bg-[#e8e8e8] dark:bg-black">
        <HeroSection showMobileGrindersPlaque={!isMdUp} />
        {isMdUp ? <LandingGrindersPlaque /> : null}
        <GraiFlowSection />
        <AnnualResultsSection />
        <GraiExitFlowSection />
        <InvestmentPathsSection />
        <PartnersSection />
        <TeamSection />
      </div>
      <Footer />
    </div>
  )
}
