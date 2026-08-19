import { isAtAppPath, toAppPath } from './appPaths'
import { writeAppUrl } from './navigate'

export type GraiSection =
  | 'mint'
  | 'claim'
  | 'lock'
  | 'unlock'
  | 'burn'
  | 'assets'
  | 'grinders'
  | 'allocate'
  | 'deallocate'
  | 'distribute'
  | 'auctions'
  | 'vote'
  | 'bribe'
  | 'liquidate'
  | 'custodian'
  | 'register'
  | 'confirm'

export const GRAI_SECTION_IDS: Record<GraiSection, string> = {
  mint: 'grai-actions-section',
  claim: 'grai-claim-section',
  lock: 'grai-actions-section',
  unlock: 'grai-actions-section',
  burn: 'grai-redeem-section',
  assets: 'grai-assets-section',
  grinders: 'grai-grinders-summary',
  allocate: 'grai-manage-section',
  deallocate: 'grai-manage-section',
  distribute: 'grai-manage-section',
  auctions: 'grai-liquidation-market',
  vote: 'grai-liquidation-market',
  bribe: 'grai-liquidation-market',
  liquidate: 'grai-manage-section',
  custodian: 'grai-manage-section',
  register: 'grai-manage-section',
  confirm: 'grai-manage-section',
}

export const GRAI_SECTION_HASHES: GraiSection[] = [
  'mint',
  'claim',
  'lock',
  'unlock',
  'burn',
  'assets',
  'grinders',
  'allocate',
  'deallocate',
  'distribute',
  'auctions',
  'vote',
  'bribe',
  'liquidate',
  'custodian',
  'register',
  'confirm',
]

const GRINDERS_PAGE_SECTIONS: ReadonlySet<GraiSection> = new Set([
  'allocate',
  'deallocate',
  'distribute',
  'liquidate',
  'custodian',
  'register',
  'confirm',
])

export function isManageSectionHash(hash: string): boolean {
  return (
    hash === 'allocate' ||
    hash === 'deallocate' ||
    hash === 'distribute' ||
    hash === 'liquidate' ||
    hash === 'custodian' ||
    hash === 'register' ||
    hash === 'confirm' ||
    hash === 'manage'
  )
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

export const GRAI_MINT_FLOW_EVENT = 'grai-mint-flow'

export function resetGraiMintToDeposit(): void {
  window.dispatchEvent(new CustomEvent(GRAI_MINT_FLOW_EVENT, { detail: 'deposit' }))
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
    writeAppUrl(nextUrl, 'push')
    onViewChange?.(logicalPath === '/grinders' ? 'grinders' : 'grai')
  } else if (`${window.location.pathname}${window.location.hash}` !== nextUrl) {
    writeAppUrl(nextUrl, 'replace')
  }

  window.dispatchEvent(new CustomEvent<GraiSection>('grai-section-nav', { detail: section }))

  window.setTimeout(() => {
    document.getElementById(GRAI_SECTION_IDS[section])?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 80)
}
