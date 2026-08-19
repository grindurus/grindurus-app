import { isAtAppPath, toAppPath } from './appPaths'
import { writeAppUrl } from './navigate'

export type AffiliatesSection = 'link' | 'dashboard' | 'program'

export const AFFILIATES_SECTION_IDS: Record<AffiliatesSection, string> = {
  link: 'affiliates-link',
  dashboard: 'affiliates-dashboard',
  program: 'affiliates-program',
}

export const AFFILIATES_SECTIONS: AffiliatesSection[] = ['link', 'dashboard', 'program']

export function readAffiliatesSectionFromHash(): AffiliatesSection | null {
  const hash = window.location.hash.slice(1)
  if (AFFILIATES_SECTIONS.includes(hash as AffiliatesSection)) return hash as AffiliatesSection
  return null
}

export function navigateToAffiliatesSection(section: AffiliatesSection): void {
  const path = toAppPath('/affiliate')
  const hash = section === 'link' ? '' : `#${section}`
  const nextUrl = `${path}${hash}`

  if (!isAtAppPath('/affiliate')) {
    writeAppUrl(nextUrl, 'push')
  } else if (`${window.location.pathname}${window.location.hash}` !== nextUrl) {
    writeAppUrl(nextUrl, 'replace')
  }

  window.dispatchEvent(new CustomEvent<AffiliatesSection>('affiliates-section-nav', { detail: section }))

  window.setTimeout(() => {
    document.getElementById(AFFILIATES_SECTION_IDS[section])?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, 80)
}
