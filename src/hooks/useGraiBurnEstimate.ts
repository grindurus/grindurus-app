import { useEffect, useState } from 'react'
import { estimateGraiBurnOutputs, type GraiBurnOutputEstimate } from '../grai/estimateGraiBurn'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { GRAI_DECIMALS } from '../grai/tokenomics'

export function useGraiBurnEstimate(graiAmountInput: string, enabled: boolean) {
  const { connection, solana, isConfigured } = useGraiDeployment()
  const [burnOutputs, setBurnOutputs] = useState<GraiBurnOutputEstimate[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!enabled || !graiAmountInput.trim() || !connection || !solana || !isConfigured) {
      setBurnOutputs([])
      setIsLoading(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setIsLoading(true)
      void estimateGraiBurnOutputs(graiAmountInput, GRAI_DECIMALS, connection, solana)
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
  }, [connection, enabled, graiAmountInput, isConfigured, solana])

  return { burnOutputs, isLoading }
}
