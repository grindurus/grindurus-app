import { isAtAppPath, toAppPath } from './appPaths'
import { writeAppUrl } from './navigate'

export type GrsSection = 'token-sale' | 'bridge' | 'grant' | 'sales' | 'vesting' | 'vest'
export type GrsOpsTab = Exclude<GrsSection, 'token-sale' | 'sales'>

export const GRS_OPS_ID = 'grs-ops'
export const GRS_SALES_ID = 'grs-sales'

export const GRS_SECTION_IDS: Record<GrsSection, string> = {
  'token-sale': GRS_SALES_ID,
  bridge: GRS_OPS_ID,
  grant: GRS_OPS_ID,
  sales: GRS_OPS_ID,
  vesting: GRS_OPS_ID,
  vest: GRS_OPS_ID,
}

export const GRS_SECTIONS: GrsSection[] = ['token-sale', 'bridge', 'vesting', 'vest', 'grant', 'sales']
export const GRS_OPS_TABS: GrsOpsTab[] = ['bridge', 'vesting', 'vest']

export const GRS_SECTION_LABELS: Record<GrsSection, string> = {
  'token-sale': 'Token Sale',
  bridge: 'Bridge',
  grant: 'Grant',
  sales: 'Sale',
  vesting: 'Release',
  vest: 'Vest',
}

export function readGrsSectionFromHash(): GrsSection | null {
  const hash = window.location.hash.slice(1)
  if (GRS_SECTIONS.includes(hash as GrsSection)) return hash as GrsSection
  return null
}

export function navigateToGrsSection(section: GrsSection): void {
  const path = toAppPath('/grs')
  const hash = section === 'bridge' ? '' : `#${section}`
  const nextUrl = `${path}${hash}`

  if (!isAtAppPath('/grs')) {
    writeAppUrl(nextUrl, 'push')
  } else if (`${window.location.pathname}${window.location.hash}` !== nextUrl) {
    writeAppUrl(nextUrl, 'replace')
  }

  window.dispatchEvent(new CustomEvent<GrsSection>('grs-section-nav', { detail: section }))

  window.setTimeout(() => {
    document.getElementById(GRS_SECTION_IDS[section])?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 80)
}
