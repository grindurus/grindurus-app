/** Logical app routes (without GitHub Pages base prefix). */
export type AppLogicalPath = '/' | '/grai' | '/grai/manage' | '/backtest'

function normalizeLogicalPath(path: string): string {
  if (!path || path === '/') return '/'
  return path.startsWith('/') ? path : `/${path}`
}

/** Full browser path including Vite `base` (e.g. `/grindurus-app/grai`). */
export function toAppPath(path: string): string {
  const logical = normalizeLogicalPath(path)
  if (logical === '/') {
    const base = import.meta.env.BASE_URL
    return base.endsWith('/') ? base.slice(0, -1) || '/' : base
  }
  const base = import.meta.env.BASE_URL
  const suffix = logical.slice(1)
  return `${base}${suffix}`
}

/** Strip Vite `base` from `location.pathname` to get a logical route. */
export function stripBasePath(pathname: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  if (!base) return pathname || '/'
  if (pathname === base) return '/'
  if (pathname.startsWith(`${base}/`)) {
    return pathname.slice(base.length)
  }
  return pathname
}

export function isAtAppPath(logicalPath: string): boolean {
  return stripBasePath(window.location.pathname) === normalizeLogicalPath(logicalPath)
}

/** Public asset URL (files in `public/`). */
export function assetUrl(path: string): string {
  const normalized = path.startsWith('/') ? path.slice(1) : path
  return `${import.meta.env.BASE_URL}${normalized}`
}
