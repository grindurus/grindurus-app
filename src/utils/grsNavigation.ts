import { isAtAppPath, toAppPath } from './appPaths'

export type GrsSection = 'bridge' | 'sales' | 'vesting' | 'vest'
export type GrsOpsTab = Exclude<GrsSection, 'sales'>

export const GRS_OPS_ID = 'grs-ops'
export const GRS_SALES_ID = 'grs-sales'

export const GRS_SECTION_IDS: Record<GrsSection, string> = {
  bridge: GRS_OPS_ID,
  sales: GRS_OPS_ID,
  vesting: GRS_OPS_ID,
  vest: GRS_OPS_ID,
}

export const GRS_SECTIONS: GrsSection[] = ['bridge', 'sales', 'vesting', 'vest']
export const GRS_OPS_TABS: GrsOpsTab[] = ['bridge', 'vesting', 'vest']

export const GRS_SECTION_LABELS: Record<GrsSection, string> = {
  bridge: 'Bridge',
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
    window.history.pushState({}, '', nextUrl)
    window.dispatchEvent(new PopStateEvent('popstate'))
  } else if (`${window.location.pathname}${window.location.hash}` !== nextUrl) {
    window.history.replaceState({}, '', nextUrl)
  }

  window.dispatchEvent(new CustomEvent<GrsSection>('grs-section-nav', { detail: section }))

  window.setTimeout(() => {
    document.getElementById(GRS_SECTION_IDS[section])?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 80)
}
