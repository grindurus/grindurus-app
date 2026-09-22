import { APP_HOME, APP_AFFILIATE } from '@landing/config'
import { TEAM } from '../../../constants/team'
import { Title } from "@landing/components/ui/Title"
import { Description } from '@landing/components/ui/Description'
import { SubTitle } from '@landing/components/ui/SubTitle'
import { Button } from '@landing/components/ui/Button'
import { AffiliateArt } from './AffiliateArt'

export function InvestmentPathsSection() {
  return (
    <section className="w-full py-6 md:py-12 lg:py-16 bg-black relative">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8">
        <div className="text-center mb-10 md:mb-16">
          <Title>Join the Ecosystem</Title>
          <Description className="max-w-[600px] mx-auto">
            Whether you're an individual investor looking for yield, or a protocol looking to harvest your own volatility, we have a path for you.
          </Description>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 md:gap-8">
          {/* Card: Retail Co-Investor */}
          <div className="flex flex-1 flex-col border border-white/10 rounded-3xl p-8 relative overflow-hidden group hover:border-brand-pink/50 transition-colors duration-500">
            {/* Glow effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-b from-brand-pink/0 to-brand-pink/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8">
              <span className="text-3xl">👥</span>
            </div>

            <SubTitle className="mb-4">
              Retail Co-Investor
            </SubTitle>
            <Description className="mb-10 flex-1">
              You don't need millions to capture institutional yield. Invest in the general crowdfunding pool to become a "co-investor" and start earning from the exact same automated strategies powering the GrindURUS network.
            </Description>
            <Button href={APP_HOME} size="md">
              Enter Pool
            </Button>
          </div>

          {/* Card: Private B2B / Partners */}
          <div className="flex flex-1 flex-col bg-[#050505] border border-white/10 rounded-3xl p-8 relative overflow-hidden group hover:border-brand-red/50 transition-colors duration-500">
            {/* Glow effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-b from-brand-red/0 to-brand-red/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8">
              <span className="text-3xl">🏢</span>
            </div>

            <SubTitle className="mb-4">
              Private Client
            </SubTitle>
            <Description className="mb-10 flex-1">
              If you have a token project or a large treasury, we can market take for you separately. Become a private client and deploy our volatility harvesting infrastructure specifically on your native asset pairs to stabilize price action and grow treasury depth.
            </Description>
            <Button
              href={TEAM[0].linkedin}
              target="_blank"
              rel="noopener noreferrer"
              size="md"
              noGradient
              className="bg-transparent border border-white/20 hover:border-brand-red hover:bg-white/5"
            >
              Become a Private Client
            </Button>
          </div>
        </div>

        <div className="mt-6 md:mt-8 flex flex-col md:flex-row items-center justify-between gap-10 md:gap-12 border border-white/10 rounded-3xl p-8 relative overflow-hidden group hover:border-brand-pink/50 transition-colors duration-500">
          <div className="absolute inset-0 bg-gradient-to-b from-brand-pink/0 to-brand-pink/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
          <div className="relative z-10 flex min-w-0 w-full max-w-[520px] flex-col items-start text-left">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8">
              <span className="text-3xl">🤝</span>
            </div>
            <Title>Affiliate</Title>
            <Description>
              Your Web3 wallet address is the ref ID.
              <br></br>
              Earn a <span className="text-brand-pink">revenue share</span>. Onchain.
            </Description>
            <Button href={APP_AFFILIATE} size="md" className="mt-8">
              Become Affiliate
            </Button>
          </div>
          <div className="relative z-10 w-full md:min-w-[360px] md:max-w-[460px]">
            <AffiliateArt />
          </div>
        </div>
      </div>
    </section>
  )
}
