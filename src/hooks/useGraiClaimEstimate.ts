import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  estimateEvmClaimAsset,
  formatClaimUsdTotal,
  type EvmClaimEstimate,
} from '../grai/evm/estimateClaim'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { formatTokenBalance } from '../grai/onchain'
import { useEvmWallet } from './useEvmWallet'

const EMPTY_CLAIM: EvmClaimEstimate = {
  assetAddress: '0x0000000000000000000000000000000000000000',
  symbol: '',
  icon: '',
  amountRaw: 0n,
  amountLabel: '0.0',
  usdRaw: 0n,
  decimals: 6,
}

export function useGraiClaimEstimate(enabled: boolean, assetAddress?: string) {
  const { chainKind, evm } = useGraiDeployment()
  const { address: evmAddress, isConnected } = useEvmWallet()
  const [claim, setClaim] = useState<EvmClaimEstimate>(EMPTY_CLAIM)
  const [claimableLabel, setClaimableLabel] = useState('—')
  const [claimableMaxAmount, setClaimableMaxAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)

  const refresh = useCallback(() => {
    setRefreshNonce((current) => current + 1)
  }, [])

  useEffect(() => {
    if (!enabled || chainKind !== 'evm' || !evm || !isConnected || !evmAddress || !assetAddress) {
      setClaim(EMPTY_CLAIM)
      setClaimableLabel('—')
      setClaimableMaxAmount('')
      return
    }

    let cancelled = false
    setIsLoading(true)
    const owner = evmAddress as `0x${string}`
    const asset = assetAddress.toLowerCase() as `0x${string}`

    void (async () => {
      try {
        const next = await estimateEvmClaimAsset(evm, owner, asset)
        if (cancelled) return
        setClaim(next)
        if (next.amountRaw > 0n) {
          const fullLabel = formatTokenBalance(next.amountRaw, next.decimals)
          setClaimableLabel(fullLabel)
          setClaimableMaxAmount(fullLabel)
        } else {
          setClaimableLabel('0')
          setClaimableMaxAmount('')
        }
      } catch {
        if (!cancelled) {
          setClaim(EMPTY_CLAIM)
          setClaimableLabel('—')
          setClaimableMaxAmount('')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [assetAddress, chainKind, enabled, evm, evmAddress, isConnected, refreshNonce])

  const usdLabel = useMemo(() => formatClaimUsdTotal(claim.usdRaw), [claim.usdRaw])

  return {
    claim,
    claimableLabel,
    claimableMaxAmount,
    usdLabel,
    isLoading,
    refresh,
  }
}
