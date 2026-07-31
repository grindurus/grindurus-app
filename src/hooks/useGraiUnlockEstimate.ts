import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  estimateEvmClaimAll,
  estimateEvmUnlockPreview,
  fetchEvmLockedGrai,
  formatClaimUsdTotal,
  formatUnlockPenaltyDuration,
  type EvmClaimEstimate,
  type EvmUnlockPreview,
} from '../grai/evm/estimateClaim'
import { estimateSolanaClaimAll } from '../grai/estimateSolanaClaim'
import { estimateSolanaUnlockPreview } from '../grai/estimateSolanaUnlock'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { formatTokenBalance } from '../grai/onchain'
import { useEvmWallet } from './useEvmWallet'
import { useSolanaWallet } from './useSolanaWallet'

const EMPTY_PREVIEW: EvmUnlockPreview = {
  unlockAmount: 0n,
  penalty: 0n,
  unlockAmountLabel: '0.0',
  penaltyLabel: '0.0',
  secondsLeft: 0,
  unlockPenaltyPeriod: 0,
  unlockFeeBps: 0,
  lockedAt: 0,
  decimals: 6,
}

export function useGraiUnlockEstimate(enabled: boolean, amountInput = '') {
  const { chainKind, evm, connection, solana } = useGraiDeployment()
  const { address: evmAddress, isConnected: isEvmConnected } = useEvmWallet()
  const { publicKey: solanaPublicKey, isConnected: isSolanaConnected } = useSolanaWallet()
  const [claims, setClaims] = useState<EvmClaimEstimate[]>([])
  const [lockedLabel, setLockedLabel] = useState('—')
  const [lockedMaxAmount, setLockedMaxAmount] = useState('')
  const [unlockPreview, setUnlockPreview] = useState<EvmUnlockPreview>(EMPTY_PREVIEW)
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000))
  const [isLoading, setIsLoading] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)

  const refresh = useCallback(() => {
    setRefreshNonce((current) => current + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setClaims([])
      setLockedLabel('—')
      setLockedMaxAmount('')
      setUnlockPreview(EMPTY_PREVIEW)
      return
    }

    let cancelled = false

    if (chainKind === 'solana') {
      if (!connection || !solana || !isSolanaConnected || !solanaPublicKey) {
        setClaims([])
        setLockedLabel('—')
        setLockedMaxAmount('')
        setUnlockPreview(EMPTY_PREVIEW)
        return
      }

      setIsLoading(true)
      const timestamp = Math.floor(Date.now() / 1000)
      void (async () => {
        try {
          const preview = await estimateSolanaUnlockPreview(
            connection,
            solana.programId,
            solanaPublicKey,
            amountInput,
            timestamp,
          )
          if (cancelled) return
          setLockedLabel(formatTokenBalance(preview.locked, preview.decimals))
          setLockedMaxAmount(
            preview.locked > 0n ? formatTokenBalance(preview.locked, preview.decimals) : '',
          )
          setUnlockPreview(preview)
          setNowSec(timestamp)
        } catch {
          if (!cancelled) {
            setLockedLabel('—')
            setLockedMaxAmount('')
            setUnlockPreview(EMPTY_PREVIEW)
          }
        }

        try {
          const nextClaims = await estimateSolanaClaimAll(connection, solana, solanaPublicKey)
          if (!cancelled) setClaims(nextClaims.filter((row) => row.amountRaw > 0n))
        } catch {
          if (!cancelled) setClaims([])
        } finally {
          if (!cancelled) setIsLoading(false)
        }
      })()

      return () => {
        cancelled = true
      }
    }

    if (chainKind !== 'evm' || !evm || !isEvmConnected || !evmAddress) {
      setClaims([])
      setLockedLabel('—')
      setLockedMaxAmount('')
      setUnlockPreview(EMPTY_PREVIEW)
      return
    }

    setIsLoading(true)
    const owner = evmAddress as `0x${string}`
    const timestamp = Math.floor(Date.now() / 1000)

    void (async () => {
      try {
        const escrow = await fetchEvmLockedGrai(evm, owner)
        if (cancelled) return
        setLockedLabel(formatTokenBalance(escrow.locked, escrow.decimals))
        setLockedMaxAmount(
          escrow.locked > 0n ? formatTokenBalance(escrow.locked, escrow.decimals) : '',
        )
      } catch {
        if (!cancelled) {
          setLockedLabel('—')
          setLockedMaxAmount('')
        }
      }

      try {
        const preview = await estimateEvmUnlockPreview(evm, owner, amountInput, timestamp)
        if (cancelled) return
        setUnlockPreview(preview)
        setNowSec(timestamp)
      } catch {
        if (!cancelled) setUnlockPreview(EMPTY_PREVIEW)
      }

      try {
        const nextClaims = await estimateEvmClaimAll(evm, owner)
        if (!cancelled) setClaims(nextClaims)
      } catch {
        if (!cancelled) setClaims([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    amountInput,
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

  const liveSecondsLeft = useMemo(() => {
    const { lockedAt, unlockPenaltyPeriod } = unlockPreview
    if (unlockPenaltyPeriod <= 0 || lockedAt <= 0) return 0
    return Math.max(0, lockedAt + unlockPenaltyPeriod - nowSec)
  }, [nowSec, unlockPreview])

  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [enabled])

  useEffect(() => {
    if (!enabled || liveSecondsLeft <= 0) return
    const id = window.setInterval(() => {
      setRefreshNonce((current) => current + 1)
    }, 15_000)
    return () => window.clearInterval(id)
  }, [enabled, liveSecondsLeft])

  const usdTotal = claims.reduce((sum, claim) => sum + claim.usdRaw, 0n)
  const usdLabel = isLoading ? '…' : formatClaimUsdTotal(usdTotal)
  const penaltyDurationLabel = formatUnlockPenaltyDuration(liveSecondsLeft)

  return {
    claims,
    usdLabel,
    lockedLabel,
    lockedMaxAmount,
    unlockPreview,
    unlockAmountLabel: unlockPreview.unlockAmountLabel,
    penaltyLabel: liveSecondsLeft > 0 ? unlockPreview.penaltyLabel : '0.0',
    penaltyDurationLabel,
    /** Always true in unlock mode once estimate is enabled — row stays visible. */
    showPenalty: enabled,
    isLoading,
    refresh,
  }
}
