import type { NavigateFunction } from 'react-router-dom'
import { isAtAppPath, stripBasePath, toAppPath } from './appPaths'

let navigateFn: NavigateFunction | null = null

export function bindAppNavigate(navigate: NavigateFunction | null): void {
  navigateFn = navigate
}

function routerHistoryState(nextIdx?: number): object {
  const prev = window.history.state
  const base = prev && typeof prev === 'object' ? { ...prev } : {}
  const idx =
    typeof nextIdx === 'number'
      ? nextIdx
      : typeof (base as { idx?: unknown }).idx === 'number'
        ? (base as { idx: number }).idx
        : 0
  return { ...base, idx }
}

function toRouterLocation(nextUrl: string): { pathname: string; search: string; hash: string } {
  const url = new URL(nextUrl, window.location.origin)
  return {
    pathname: stripBasePath(url.pathname) || '/',
    search: url.search,
    hash: url.hash,
  }
}

/** Keep React Router in sync. Prefer `navigate()` over raw history + synthetic popstate. */
export function writeAppUrl(nextUrl: string, mode: 'push' | 'replace'): void {
  if (navigateFn) {
    navigateFn(toRouterLocation(nextUrl), { replace: mode === 'replace' })
    return
  }

  if (mode === 'push') {
    const prevIdx = (window.history.state as { idx?: number } | null)?.idx
    const idx = (typeof prevIdx === 'number' ? prevIdx : 0) + 1
    window.history.pushState(routerHistoryState(idx), '', nextUrl)
  } else {
    window.history.replaceState(routerHistoryState(), '', nextUrl)
  }
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/** Replace only the hash, and only while still on `logicalPath`. */
export function replaceAppHash(logicalPath: string, hash: string): void {
  if (!isAtAppPath(logicalPath)) return
  const nextUrl = `${window.location.pathname}${hash}`
  if (`${window.location.pathname}${window.location.hash}` === nextUrl) return
  writeAppUrl(nextUrl, 'replace')
}

export function navigateTo(path: string): void {
  if (isAtAppPath(path)) return
  writeAppUrl(toAppPath(path), 'push')
}
