import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  estimateEvmClaimAsset,
  formatClaimUsdTotal,
  type EvmClaimEstimate,
} from '../grai/evm/estimateClaim'
import { estimateSolanaClaimAll } from '../grai/estimateSolanaClaim'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { formatTokenBalance } from '../grai/onchain'
import { useEvmWallet } from './useEvmWallet'
import { useSolanaWallet } from './useSolanaWallet'

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
  const { chainKind, evm, connection, solana } = useGraiDeployment()
  const { address: evmAddress, isConnected: isEvmConnected } = useEvmWallet()
  const { publicKey: solanaPublicKey, isConnected: isSolanaConnected } = useSolanaWallet()
  const [claim, setClaim] = useState<EvmClaimEstimate>(EMPTY_CLAIM)
  const [claims, setClaims] = useState<EvmClaimEstimate[]>([])
  const [claimableLabel, setClaimableLabel] = useState('—')
  const [claimableMaxAmount, setClaimableMaxAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)

  const refresh = useCallback(() => {
    setRefreshNonce((current) => current + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setClaim(EMPTY_CLAIM)
      setClaims([])
      setClaimableLabel('—')
      setClaimableMaxAmount('')
      return
    }

    let cancelled = false
    setIsLoading(true)

    if (chainKind === 'solana') {
      if (!connection || !solana || !isSolanaConnected || !solanaPublicKey) {
        setClaim(EMPTY_CLAIM)
        setClaims([])
        setClaimableLabel('—')
        setClaimableMaxAmount('')
        setIsLoading(false)
        return
      }

      void (async () => {
        try {
          const all = await estimateSolanaClaimAll(connection, solana, solanaPublicKey)
          if (cancelled) return
          setClaims(all)

          const next = assetAddress
            ? (all.find(
                (row) => row.assetAddress.toLowerCase() === assetAddress.toLowerCase(),
              ) ?? EMPTY_CLAIM)
            : EMPTY_CLAIM

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
            setClaims([])
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
    }

    if (chainKind !== 'evm' || !evm || !isEvmConnected || !evmAddress || !assetAddress) {
      setClaim(EMPTY_CLAIM)
      setClaims([])
      setClaimableLabel('—')
      setClaimableMaxAmount('')
      setIsLoading(false)
      return
    }

    const owner = evmAddress as `0x${string}`
    const asset = assetAddress.toLowerCase() as `0x${string}`

    void (async () => {
      try {
        const next = await estimateEvmClaimAsset(evm, owner, asset)
        if (cancelled) return
        setClaim(next)
        setClaims([next])
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
          setClaims([])
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
  }, [
    assetAddress,
    chainKind,
    connection,
    enabled,
    evm,
    evmAddress,
    isEvmConnected,
    isSolanaConnected,
    refreshNonce,
    solana,
    solanaPublicKey,
  ])

  const usdLabel = useMemo(() => formatClaimUsdTotal(claim.usdRaw), [claim.usdRaw])

  return {
    claim,
    claims,
    claimableLabel,
    claimableMaxAmount,
    usdLabel,
    isLoading,
    refresh,
  }
}
