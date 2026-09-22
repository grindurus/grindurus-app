/* Lemniscate path for even arc-length distribution (64 points) */
export const LEMNISCATE_PATH = (() => {
  const pts: string[] = []
  const scaleX = 520
  const scaleY = 500
  for (let i = 0; i <= 64; i++) {
    const t = (2 * Math.PI * i) / 64
    const denom = 1 + Math.sin(t) ** 2
    const x = (Math.cos(t) / denom) * scaleX
    const y = ((Math.sin(t) * Math.cos(t)) / denom) * scaleY
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return `M ${pts.join(' L ')} Z`
})()
