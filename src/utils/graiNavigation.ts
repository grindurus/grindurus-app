import { isAtAppPath, toAppPath } from './appPaths'

export type GraiSection =
  | 'mint'
  | 'claim'
  | 'lock'
  | 'unlock'
  | 'burn'
  | 'assets'
  | 'buyback'
  | 'grinders'
  | 'allocate'
  | 'distribute'
  | 'auctions'
  | 'vote'
  | 'bribe'

export const GRAI_SECTION_IDS: Record<GraiSection, string> = {
  mint: 'grai-actions-section',
  claim: 'grai-actions-section',
  lock: 'grai-actions-section',
  unlock: 'grai-actions-section',
  burn: 'grai-actions-section',
  assets: 'grai-assets-section',
  buyback: 'grai-buyback-section',
  grinders: 'grai-grinders-summary',
  allocate: 'grai-manage-section',
  distribute: 'grai-manage-section',
  auctions: 'grai-liquidation-market',
  vote: 'grai-liquidation-market',
  bribe: 'grai-liquidation-market',
}

export const GRAI_SECTION_HASHES: GraiSection[] = [
  'mint',
  'claim',
  'lock',
  'unlock',
  'burn',
  'assets',
  'buyback',
  'grinders',
  'allocate',
  'distribute',
  'auctions',
  'vote',
  'bribe',
]

const GRINDERS_PAGE_SECTIONS: ReadonlySet<GraiSection> = new Set(['allocate', 'distribute'])

export function isManageSectionHash(hash: string): boolean {
  return hash === 'allocate' || hash === 'distribute' || hash === 'manage'
}

export function readGraiSectionFromHash(): GraiSection | null {
  const hash = window.location.hash.slice(1)
  if (hash === 'manage') return 'allocate'
  if (GRAI_SECTION_HASHES.includes(hash as GraiSection)) {
    return hash as GraiSection
  }
  return null
}

function sectionAppPath(section: GraiSection): '/grai' | '/grinders' {
  return GRINDERS_PAGE_SECTIONS.has(section) ? '/grinders' : '/grai'
}

export function navigateToGraiSection(
  section: GraiSection,
  onViewChange?: (view: 'grai' | 'grinders') => void,
): void {
  const logicalPath = sectionAppPath(section)
  const path = toAppPath(logicalPath)
  const hash = section === 'mint' ? '' : `#${section}`
  const nextUrl = `${path}${hash}`

  if (!isAtAppPath(logicalPath)) {
    window.history.pushState({}, '', nextUrl)
    window.dispatchEvent(new PopStateEvent('popstate'))
    onViewChange?.(logicalPath === '/grinders' ? 'grinders' : 'grai')
  } else if (`${window.location.pathname}${window.location.hash}` !== nextUrl) {
    window.history.replaceState({}, '', nextUrl)
  }

  window.dispatchEvent(new CustomEvent<GraiSection>('grai-section-nav', { detail: section }))

  window.setTimeout(() => {
    document.getElementById(GRAI_SECTION_IDS[section])?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 80)
}
