import { Link } from 'react-router-dom'
import { APP_HOME } from '@landing/config'
import logo from '@landing/assets/logo.png'
import { Button } from '@landing/components/ui/Button'

function Header() {
  return (
    <header className="w-full fixed top-0 z-[200] border-b border-black/10 dark:border-white/10 bg-white/95 dark:bg-black/95 backdrop-blur-md">
      <div className="w-full px-4 sm:px-8 h-[64px] sm:h-[74px] flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 no-underline group">
          <img src={logo} alt="GrindURUS" className="w-9 h-9 sm:w-10 sm:h-10 object-contain" />
          <span
            className="hidden sm:inline text-2xl font-semibold font-mono bg-shimmer-size animate-shimmer bg-clip-text text-transparent"
            style={{
              backgroundImage:
                'linear-gradient(90deg, #ff69b4, #ffffff, #ff1493, #ffffff, #ff69b4)',
            }}
          >
            GrindURUS
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <Button href={APP_HOME} size="sm">
            Open App
          </Button>
        </div>
      </div>
    </header>
  )
}

export default Header
