import { isAtAppPath, toAppPath } from './appPaths'
import { writeAppUrl } from './navigate'

export type BacktestSection = 'create' | 'priority' | 'queue' | 'results'

export const BACKTEST_SECTION_IDS: Record<BacktestSection, string> = {
  create: 'backtest-create-section',
  priority: 'backtest-priority-section',
  queue: 'backtest-queue-section',
  results: 'backtest-results-section',
}

export const BACKTEST_SECTIONS: BacktestSection[] = ['create', 'priority', 'queue', 'results']

export function readBacktestSectionFromHash(): BacktestSection | null {
  const hash = window.location.hash.slice(1)
  if (BACKTEST_SECTIONS.includes(hash as BacktestSection)) return hash as BacktestSection
  return null
}

export function navigateToBacktestSection(section: BacktestSection): void {
  const path = toAppPath('/backtest')
  const hash = section === 'create' ? '' : `#${section}`
  const nextUrl = `${path}${hash}`

  if (!isAtAppPath('/backtest')) {
    writeAppUrl(nextUrl, 'push')
  } else if (`${window.location.pathname}${window.location.hash}` !== nextUrl) {
    writeAppUrl(nextUrl, 'replace')
  }

  window.dispatchEvent(new CustomEvent<BacktestSection>('backtest-section-nav', { detail: section }))

  window.setTimeout(() => {
    document
      .getElementById(BACKTEST_SECTION_IDS[section])
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 80)
}
