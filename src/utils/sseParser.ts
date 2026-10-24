export function parseSseDataBlock(block: string): string | null {
  const lines = block.split(/\r?\n/)
  const parts: string[] = []
  for (const line of lines) {
    if (!line.length || line.startsWith(':')) continue
    if (line.startsWith('data:')) {
      let rest = line.slice(5)
      if (rest.startsWith(' ')) rest = rest.slice(1)
      parts.push(rest)
    }
  }
  if (parts.length === 0) return null
  return parts.join('\n')
}

function findSseEventBoundary(buffer: string): { index: number; skip: number } | null {
  const idxLf = buffer.indexOf('\n\n')
  const idxCr = buffer.indexOf('\r\n\r\n')
  if (idxLf !== -1 && (idxCr === -1 || idxLf <= idxCr)) {
    return { index: idxLf, skip: 2 }
  }
  if (idxCr !== -1) {
    return { index: idxCr, skip: 4 }
  }
  return null
}

export function consumeCompleteSseEvents(
  buffer: string,
  onMessage?: (data: string) => void,
): string {
  let remaining = buffer
  let boundary = findSseEventBoundary(remaining)
  while (boundary) {
    const block = remaining.slice(0, boundary.index)
    remaining = remaining.slice(boundary.index + boundary.skip)
    const data = parseSseDataBlock(block)
    if (data != null) onMessage?.(data)
    boundary = findSseEventBoundary(remaining)
  }
  return remaining
}
