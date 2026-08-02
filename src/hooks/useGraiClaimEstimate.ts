import { useCallback, useEffect, useMemo, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
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

export function useGraiClaimEstimate(
  enabled: boolean,
  assetAddress?: string,
  holderAddress?: string | null,
) {
  const { chainKind, evm, connection, solana } = useGraiDeployment()
  const { address: evmAddress } = useEvmWallet()
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
      let holderKey: PublicKey | null = null
      if (holderAddress && holderAddress.length > 0) {
        try {
          holderKey = new PublicKey(holderAddress)
        } catch {
          holderKey = null
        }
      } else if (isSolanaConnected && solanaPublicKey) {
        holderKey = solanaPublicKey
      }

      if (!connection || !solana || !holderKey) {
        setClaim(EMPTY_CLAIM)
        setClaims([])
        setClaimableLabel('—')
        setClaimableMaxAmount('')
        setIsLoading(false)
        return
      }

      void (async () => {
        try {
          const all = await estimateSolanaClaimAll(connection, solana, holderKey!)
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

    const owner = (
      holderAddress && holderAddress.startsWith('0x') ? holderAddress : evmAddress
    ) as `0x${string}` | undefined

    // Public read: holder may be any locker; wallet connect is only required to submit claim.
    if (chainKind !== 'evm' || !evm || !owner || !assetAddress) {
      setClaim(EMPTY_CLAIM)
      setClaims([])
      setClaimableLabel('—')
      setClaimableMaxAmount('')
      setIsLoading(false)
      return
    }

    const asset = assetAddress.toLowerCase() as `0x${string}`

    void (async () => {
      try {
        const next = await estimateEvmClaimAsset(evm, owner.toLowerCase() as `0x${string}`, asset)
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
    holderAddress,
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
