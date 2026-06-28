import { useEffect, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { estimateGraiMintOutput } from '../grai/estimateGraiMint'
import { formatTokenBalance } from '../grai/onchain'
import { GRAI_DECIMALS } from '../grai/tokenomics'

export function useGraiMintEstimate(
  assetMint: string | undefined,
  amountInput: string,
  assetDecimals: number | null,
) {
  const [estimatedGrai, setEstimatedGrai] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!assetMint || assetDecimals === null || !amountInput.trim()) {
      setEstimatedGrai(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setIsLoading(true)
      void estimateGraiMintOutput(new PublicKey(assetMint), amountInput, assetDecimals)
        .then((raw) => {
          if (cancelled) return
          setEstimatedGrai(raw === null ? null : formatTokenBalance(raw, GRAI_DECIMALS))
        })
        .catch(() => {
          if (!cancelled) setEstimatedGrai(null)
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false)
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [amountInput, assetDecimals, assetMint])

  return { estimatedGrai, isLoading }
}
