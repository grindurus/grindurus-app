import { useLayoutEffect, type RefObject } from 'react'
import { resetGraiMintToDeposit } from '../utils/graiNavigation'

const HEADER_MENU_SELECTOR =
  '.header-nav-caret-btn, .header-nav-dropdown, .header-menu-btn, .header-mobile-backdrop'

function pathAtPoint(header: HTMLElement, x: number, y: number): string | null {
  for (const item of header.querySelectorAll<HTMLElement>('[data-app-path]')) {
    const rect = item.getBoundingClientRect()
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return item.getAttribute('data-app-path')
    }
  }
  return null
}

/**
 * Product nav clicks always reset the mint Deposit/Claim switch first.
 * If Claim (or another page layer) stole the pointer, navigate from the
 * header link under the cursor instead of letting that layer keep the event.
 */
export function useHeaderNavClicks(
  headerRef: RefObject<HTMLElement | null>,
  goToPath: (path: string) => void,
): void {
  useLayoutEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const header = headerRef.current
      if (!header) return

      const { top, bottom } = header.getBoundingClientRect()
      if (event.clientY < top || event.clientY > bottom) return
      if (event.target instanceof Element && event.target.closest(HEADER_MENU_SELECTOR)) return

      resetGraiMintToDeposit()

      if (event.target instanceof Node && header.contains(event.target)) return

      const path = pathAtPoint(header, event.clientX, event.clientY)
      if (!path) return
      event.preventDefault()
      event.stopImmediatePropagation()
      goToPath(path)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [goToPath, headerRef])
}
