import { useEffect, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { estimateGraiMintOutput } from '../grai/estimateGraiMint'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { formatTokenBalance } from '../grai/onchain'
import { GRAI_DECIMALS } from '../grai/tokenomics'

function formatMintShareLabel(raw: bigint, decimals: number): string {
  if (raw <= 0n) return '0.0'

  const label = formatTokenBalance(raw, decimals)
  return label.includes('.') ? label : `${label}.0`
}

export function useGraiMintEstimate(
  assetMint: string | undefined,
  amountInput: string,
  assetDecimals: number | null,
) {
  const { connection, solana, isConfigured } = useGraiDeployment()
  const [estimatedGrai, setEstimatedGrai] = useState<string | null>(null)
  const [seniorShareLabel, setSeniorShareLabel] = useState<string | null>(null)
  const [juniorShareLabel, setJuniorShareLabel] = useState<string | null>(null)
  const [seniorShareUsdRaw, setSeniorShareUsdRaw] = useState<bigint>(0n)
  const [juniorShareUsdRaw, setJuniorShareUsdRaw] = useState<bigint>(0n)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!assetMint || assetDecimals === null || !amountInput.trim() || !connection || !solana || !isConfigured) {
      setEstimatedGrai(null)
      setSeniorShareLabel(null)
      setJuniorShareLabel(null)
      setSeniorShareUsdRaw(0n)
      setJuniorShareUsdRaw(0n)
      setIsLoading(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setIsLoading(true)
      void estimateGraiMintOutput(new PublicKey(assetMint), amountInput, assetDecimals, connection, solana)
        .then((estimate) => {
          if (cancelled) return
          if (estimate === null) {
            setEstimatedGrai(null)
            setSeniorShareLabel(null)
            setJuniorShareLabel(null)
            setSeniorShareUsdRaw(0n)
            setJuniorShareUsdRaw(0n)
            return
          }
          setEstimatedGrai(formatTokenBalance(estimate.graiRaw, GRAI_DECIMALS))
          setSeniorShareLabel(formatMintShareLabel(estimate.seniorRaw, assetDecimals))
          setJuniorShareLabel(formatMintShareLabel(estimate.juniorRaw, assetDecimals))
          setSeniorShareUsdRaw(estimate.seniorUsdRaw)
          setJuniorShareUsdRaw(estimate.juniorUsdRaw)
        })
        .catch(() => {
          if (!cancelled) {
            setEstimatedGrai(null)
            setSeniorShareLabel(null)
            setJuniorShareLabel(null)
            setSeniorShareUsdRaw(0n)
            setJuniorShareUsdRaw(0n)
          }
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false)
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [amountInput, assetDecimals, assetMint, connection, isConfigured, solana])

  return { estimatedGrai, seniorShareLabel, juniorShareLabel, seniorShareUsdRaw, juniorShareUsdRaw, isLoading }
}
