import { useEffect, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { estimateEvmGraiMintOutput } from '../grai/evm/estimateMint'
import { GRAI_DECIMALS_EVM } from '../grai/evm/constants'
import { estimateGraiMintOutput } from '../grai/estimateGraiMint'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { formatTokenBalance } from '../grai/onchain'
import { GRAI_DECIMALS } from '../grai/tokenomics'

function formatMintShareLabel(raw: bigint, decimals: number): string {
  if (raw <= 0n) return '0.0'

  const label = formatTokenBalance(raw, decimals)
  return label.includes('.') ? label : `${label}.0`
}

function formatMintGraiLabel(raw: bigint, decimals: number): string {
  if (raw <= 0n) return '0.0'

  const label = formatTokenBalance(raw, decimals, 1)
  return label.includes('.') ? label : `${label}.0`
}

export function useGraiMintEstimate(
  assetMint: string | undefined,
  amountInput: string,
  assetDecimals: number | null,
) {
  const { connection, solana, evm, chainKind, isConfigured } = useGraiDeployment()
  const [estimatedGrai, setEstimatedGrai] = useState<string | null>(null)
  const [seniorShareLabel, setSeniorShareLabel] = useState<string | null>(null)
  const [juniorShareLabel, setJuniorShareLabel] = useState<string | null>(null)
  const [seniorShareUsdRaw, setSeniorShareUsdRaw] = useState<bigint>(0n)
  const [juniorShareUsdRaw, setJuniorShareUsdRaw] = useState<bigint>(0n)
  const [isLoading, setIsLoading] = useState(false)

  const graiDecimals = chainKind === 'evm' ? GRAI_DECIMALS_EVM : GRAI_DECIMALS

  useEffect(() => {
    if (!assetMint || assetDecimals === null || !amountInput.trim() || !isConfigured) {
      setEstimatedGrai(null)
      setSeniorShareLabel(null)
      setJuniorShareLabel(null)
      setSeniorShareUsdRaw(0n)
      setJuniorShareUsdRaw(0n)
      setIsLoading(false)
      return
    }

    const isSolanaReady = chainKind === 'solana' && connection && solana
    const isEvmReady = chainKind === 'evm' && evm
    if (!isSolanaReady && !isEvmReady) {
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
      const estimatePromise =
        chainKind === 'evm' && evm
          ? estimateEvmGraiMintOutput(evm, assetMint, amountInput, assetDecimals)
          : estimateGraiMintOutput(
              new PublicKey(assetMint),
              amountInput,
              assetDecimals,
              connection!,
              solana!,
            )

      void estimatePromise
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
          setEstimatedGrai(formatMintGraiLabel(estimate.graiRaw, graiDecimals))
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
  }, [amountInput, assetDecimals, assetMint, chainKind, connection, evm, graiDecimals, isConfigured, solana])

  return { estimatedGrai, seniorShareLabel, juniorShareLabel, seniorShareUsdRaw, juniorShareUsdRaw, isLoading }
}
