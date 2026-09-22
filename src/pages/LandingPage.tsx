import Header from '@landing/components/layout/Header'
import Footer from '@landing/components/layout/Footer'
import { HeroSection } from '@landing/components/sections/hero/HeroSection'
import { PartnersSection } from '@landing/components/sections/partners/PartnersSection'
import { TeamSection } from '@landing/components/sections/team/TeamSection'
import { StrategySection } from '@landing/components/sections/strategy/StrategySection'
import { GraiProductSection } from '@landing/components/sections/product/GraiProductSection'
import { AnnualResultsSection } from '@landing/components/sections/results/AnnualResultsSection'
import { CalculatorCtaSection } from '@landing/components/sections/calculator/CalculatorCtaSection'
import { InvestmentPathsSection } from '@landing/components/sections/invest/InvestmentPathsSection'
import '@landing/landing.css'

export default function LandingPage() {
  return (
    <div className="landing-root flex flex-col min-h-screen bg-[#e8e8e8] dark:bg-black">
      <Header />
      <div className="flex-1 relative bg-[#e8e8e8] dark:bg-black">
        <HeroSection />
        <StrategySection />
        <GraiProductSection />
        <AnnualResultsSection />
        <CalculatorCtaSection />
        <InvestmentPathsSection />
        <PartnersSection />
        <TeamSection />
      </div>
      <Footer />
    </div>
  )
}
