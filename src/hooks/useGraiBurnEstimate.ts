import { useEffect, useState } from 'react'
import { estimateGraiBurnOutputs, type GraiBurnOutputEstimate } from '../grai/estimateGraiBurn'
import { GRAI_DECIMALS } from '../grai/tokenomics'

export function useGraiBurnEstimate(graiAmountInput: string, enabled: boolean) {
  const [burnOutputs, setBurnOutputs] = useState<GraiBurnOutputEstimate[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!enabled || !graiAmountInput.trim()) {
      setBurnOutputs([])
      setIsLoading(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setIsLoading(true)
      void estimateGraiBurnOutputs(graiAmountInput, GRAI_DECIMALS)
        .then((outputs) => {
          if (cancelled) return
          setBurnOutputs(outputs ?? [])
        })
        .catch(() => {
          if (!cancelled) setBurnOutputs([])
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false)
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [enabled, graiAmountInput])

  return { burnOutputs, isLoading }
}
