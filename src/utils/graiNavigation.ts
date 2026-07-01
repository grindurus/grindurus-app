import { isAtAppPath, toAppPath } from './appPaths'

export type GraiSection = 'mint' | 'burn' | 'assets' | 'grinders' | 'allocate' | 'distribute'

export const GRAI_SECTION_IDS: Record<GraiSection, string> = {
  mint: 'grai-actions-section',
  burn: 'grai-actions-section',
  assets: 'grai-assets-section',
  grinders: 'grai-grinders-summary',
  allocate: 'grai-manage-section',
  distribute: 'grai-manage-section',
}

const GRAI_SECTION_HASHES: GraiSection[] = ['mint', 'burn', 'assets', 'grinders', 'allocate', 'distribute']

export function readGraiSectionFromHash(): GraiSection | null {
  const hash = window.location.hash.slice(1)
  if (hash === 'manage') return 'allocate'
  if (GRAI_SECTION_HASHES.includes(hash as GraiSection)) {
    return hash as GraiSection
  }
  return null
}

export function navigateToGraiSection(
  section: GraiSection,
  onViewChange?: (view: 'grai') => void,
): void {
  const path = toAppPath('/grai')
  const hash = `#${section}`

  if (!isAtAppPath('/grai')) {
    window.history.pushState({}, '', `${path}${hash}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
    onViewChange?.('grai')
  } else if (window.location.hash !== hash) {
    window.history.replaceState({}, '', `${path}${hash}`)
  }

  window.dispatchEvent(new CustomEvent<GraiSection>('grai-section-nav', { detail: section }))

  window.setTimeout(() => {
    document.getElementById(GRAI_SECTION_IDS[section])?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 80)
}
