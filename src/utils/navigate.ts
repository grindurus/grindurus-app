import { isAtAppPath, toAppPath } from './appPaths'

export function navigateTo(path: string): void {
  if (isAtAppPath(path)) return
  window.history.pushState({}, '', toAppPath(path))
  window.dispatchEvent(new PopStateEvent('popstate'))
}
