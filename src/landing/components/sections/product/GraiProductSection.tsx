import { APP_HOME } from '@landing/config'
import { Title } from "@landing/components/ui/Title"
import { Description } from '@landing/components/ui/Description'
import { Button } from '@landing/components/ui/Button'
import { GraiHolderScene } from './GraiHolderScene'

export function GraiProductSection() {
  return (
    <section className="relative w-full py-6 md:py-12 lg:py-16 bg-black">
      <div className="flex flex-col md:flex-row justify-between gap-10 md:gap-8 max-w-[1280px] mx-auto px-4 sm:px-8">
        {/* Left: Text Content */}
        <div className="flex min-w-0 max-w-full flex-col items-start text-left">
          <Title className="flex flex-col gap-2">
            <div className="text-white">
              <span className="block">
                <span className="text-brand-pink">GR</span>inders
              </span>
              <span className="block">
                <span className="text-brand-pink">A</span>rtificial
              </span>
              <span className="block">
                <span className="text-brand-pink">I</span>ndex.
              </span>
            </div>
          </Title>
          <Description>
            <span className="text-brand-pink">GRAI</span> gives you passive access to the{' '}
            <span className="text-brand-pink">yield</span>
            <br></br>
            You earn <span className="text-brand-pink">yield</span> directly to your wallet.
          </Description>
          <p className="mb-10 mt-3 text-sm md:text-base font-mono leading-relaxed text-white">
            Let GrindURUS harvest volatility.
          </p>
          <Button href={APP_HOME} size="md">
            Explore GRAI
          </Button>
        </div>

        <div className="relative flex min-h-[500px] w-full md:min-w-[400px] md:max-w-[440px] flex-col items-center justify-center">
          <GraiHolderScene />
        </div>
      </div>
    </section>
  )
}
