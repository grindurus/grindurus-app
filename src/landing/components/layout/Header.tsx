import { Link } from 'react-router-dom'
import { APP_HOME } from '@landing/config'
import logo from '@landing/assets/logo.png'
import { Button } from '@landing/components/ui/Button'

function Header() {
  return (
    <header className="w-full fixed top-0 z-[200] border-b border-white/10 bg-black/95 backdrop-blur-md">
      <div className="w-full px-4 sm:px-8 h-[64px] sm:h-[74px] flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-3 no-underline hover:opacity-80 transition-opacity"
          style={{ color: '#ffffff' }}
        >
          <img src={logo} alt="GrindURUS" className="w-9 h-9 sm:w-10 sm:h-10 object-contain" />
          <span
            className="hidden sm:inline text-[1.6rem] font-bold leading-none tracking-[-0.01em] whitespace-nowrap"
            style={{ color: '#ffffff' }}
          >
            GrindURUS
          </span>
        </Link>

        <div className="flex items-center gap-4 mr-3 sm:mr-0">
          <Button href={APP_HOME} size="sm">
            Open App
          </Button>
        </div>
      </div>
    </header>
  )
}

export default Header
