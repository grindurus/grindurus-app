import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { fetchGraiRegistryAssets } from '../grai/fetchAssets'
import { fetchGraiVaultBalances, type GraiAssetVaultBalances } from '../grai/fetchVaultBalances'
import { fetchGraiMintSupply } from '../grai/fetchGraiMintSupply'
import {
  fetchGrinderCustodyHoldings,
  indexGrinderCustodyHoldings,
  mergeGrinderCustodyHoldings,
  solanaClusterToCustodyNetwork,
} from '../grai/custodyHoldings'
import { grinderCustodyAddress, type GrinderConfig } from '../grai/grinders'
import { fetchCustodyWalletBalances } from '../grai/fetchCustodyWalletBalances'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { type GraiAsset } from '../grai/knownMints'
import {
  type GrinderCustodyState,
  toGrinderCustodyRow,
  parseCustodyWallet,
} from '../grai/grinderCustodyState'
import { useWalletContext } from './AppWalletProvider'
import { useSolanaWallet } from '../hooks/useSolanaWallet'

type GraiDataContextValue = {
  assets: GraiAsset[]
  assetsLoading: boolean
  assetsError: string | null
  isRegistryLoaded: boolean
  isWalletReady: boolean
  vaultBalances: Record<string, GraiAssetVaultBalances>
  vaultBalancesLoading: boolean
  vaultBalancesError: string | null
  totalSupplyLabel: string
  totalSupplyLoading: boolean
  totalSupplyError: string | null
  grindersCustodyRows: GrinderCustodyState[]
  grindersCustodyLoading: boolean
  grindersCustodyError: string | null
  refreshAssets: () => Promise<void>
  refreshVaultBalances: () => Promise<void>
  refreshTotalSupply: () => Promise<void>
  refreshGrindersCustody: () => Promise<void>
  requestGrindersCustody: (grinders: GrinderConfig[]) => void
}

const GraiDataContext = createContext<GraiDataContextValue | undefined>(undefined)

export function GraiDataProvider({ children }: { children: ReactNode }) {
  const { selectedChainType } = useWalletContext()
  const { isConnected } = useSolanaWallet()
  const { connection, solana, hasStaticConfig, isConfigured } = useGraiDeployment()

  const isWalletReady = selectedChainType === 'solana' && isConnected

  const [assets, setAssets] = useState<GraiAsset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(true)
  const [assetsError, setAssetsError] = useState<string | null>(null)
  const [isRegistryLoaded, setIsRegistryLoaded] = useState(false)

  const [vaultBalances, setVaultBalances] = useState<Record<string, GraiAssetVaultBalances>>({})
  const [vaultBalancesLoading, setVaultBalancesLoading] = useState(true)
  const [vaultBalancesError, setVaultBalancesError] = useState<string | null>(null)

  const [totalSupplyLabel, setTotalSupplyLabel] = useState('…')
  const [totalSupplyLoading, setTotalSupplyLoading] = useState(true)
  const [totalSupplyError, setTotalSupplyError] = useState<string | null>(null)

  const [grindersCustodyRows, setGrindersCustodyRows] = useState<GrinderCustodyState[]>([])
  const [grindersCustodyLoading, setGrindersCustodyLoading] = useState(false)
  const [grindersCustodyError, setGrindersCustodyError] = useState<string | null>(null)

  const grindersRef = useRef<GrinderConfig[] | null>(null)
  const [custodyEnabled, setCustodyEnabled] = useState(false)

  const refreshAssets = useCallback(async () => {
    if (!hasStaticConfig) {
      setAssets([])
      setIsRegistryLoaded(false)
      setAssetsError('GRAI is not configured for this network')
      setAssetsLoading(false)
      return
    }
    if (!connection || !solana) {
      setAssetsLoading(true)
      return
    }

    setAssetsLoading(true)
    setAssetsError(null)
    try {
      const registryAssets = await fetchGraiRegistryAssets(connection, solana)
      setAssets(registryAssets)
      setIsRegistryLoaded(registryAssets.length > 0)
    } catch (err) {
      setAssets([])
      setIsRegistryLoaded(false)
      setAssetsError(err instanceof Error ? err.message : 'Failed to load GRAI assets')
    } finally {
      setAssetsLoading(false)
    }
  }, [connection, hasStaticConfig, solana])

  const refreshVaultBalances = useCallback(async () => {
    if (!hasStaticConfig) {
      setVaultBalances({})
      setVaultBalancesError('GRAI is not configured for this network')
      setVaultBalancesLoading(false)
      return
    }
    if (!connection || !solana) {
      setVaultBalancesLoading(true)
      return
    }

    setVaultBalancesLoading(true)
    setVaultBalancesError(null)
    try {
      const balances = await fetchGraiVaultBalances(connection, solana)
      setVaultBalances(balances)
    } catch (err) {
      setVaultBalances({})
      setVaultBalancesError(err instanceof Error ? err.message : 'Failed to load vault balances')
    } finally {
      setVaultBalancesLoading(false)
    }
  }, [connection, hasStaticConfig, solana])

  const refreshTotalSupply = useCallback(async () => {
    if (!hasStaticConfig) {
      setTotalSupplyLabel('—')
      setTotalSupplyError('GRAI is not configured for this network')
      setTotalSupplyLoading(false)
      return
    }
    if (!connection || !solana) {
      setTotalSupplyLoading(true)
      return
    }

    setTotalSupplyLoading(true)
    setTotalSupplyError(null)
    try {
      const supply = await fetchGraiMintSupply(connection, solana)
      setTotalSupplyLabel(supply.label)
    } catch (err) {
      setTotalSupplyLabel('—')
      setTotalSupplyError(err instanceof Error ? err.message : 'Failed to load GRAI total supply')
    } finally {
      setTotalSupplyLoading(false)
    }
  }, [connection, hasStaticConfig, solana])

  const refreshGrindersCustody = useCallback(async () => {
    const grinders = grindersRef.current
    if (!grinders) return

    setGrindersCustodyLoading(true)
    setGrindersCustodyError(null)

    try {
      const backendByGrinder = indexGrinderCustodyHoldings(
        await fetchGrinderCustodyHoldings(grinders.map((grinder) => grinder.id)),
      )

      if (!connection || !solana || !isConfigured) {
        setGrindersCustodyRows(
          grinders.map((grinder) => {
            const base = toGrinderCustodyRow(grinder)
            const custodyAddress = base.custodyWalletAddress
            return {
              ...base,
              holdings: mergeGrinderCustodyHoldings({
                backendHoldings: backendByGrinder[grinder.id] ?? [],
                onChainBalances: {},
                custodyAddress,
                solanaNetwork: solanaClusterToCustodyNetwork(solana?.cluster ?? 'devnet'),
              }),
            }
          }),
        )
        return
      }

      const solanaNetwork = solanaClusterToCustodyNetwork(solana.cluster)

      const nextRows = await Promise.all(
        grinders.map(async (grinder) => {
          const custodyWallet = parseCustodyWallet(grinder.custodyWallet)
          const base = toGrinderCustodyRow(grinder)
          const custodyAddress = grinderCustodyAddress(grinder, custodyWallet)

          if (!custodyWallet) {
            return {
              ...base,
              holdings: mergeGrinderCustodyHoldings({
                backendHoldings: backendByGrinder[grinder.id] ?? [],
                onChainBalances: {},
                custodyAddress,
                solanaNetwork,
              }),
            }
          }

          const balances = await fetchCustodyWalletBalances(connection, solana, custodyWallet)
          return {
            ...base,
            custodyWallet,
            custodyWalletAddress: custodyAddress,
            balances,
            holdings: mergeGrinderCustodyHoldings({
              backendHoldings: backendByGrinder[grinder.id] ?? [],
              onChainBalances: balances,
              custodyAddress,
              solanaNetwork,
            }),
          }
        }),
      )
      setGrindersCustodyRows(nextRows)
    } catch (err) {
      setGrindersCustodyError(err instanceof Error ? err.message : 'Failed to load grinder custody balances')
    } finally {
      setGrindersCustodyLoading(false)
    }
  }, [connection, isConfigured, solana])

  const requestGrindersCustody = useCallback((grinders: GrinderConfig[]) => {
    grindersRef.current = grinders
    setCustodyEnabled(true)
    setGrindersCustodyRows(grinders.map(toGrinderCustodyRow))
  }, [])

  useEffect(() => {
    void refreshAssets()
    void refreshVaultBalances()
    void refreshTotalSupply()
  }, [refreshAssets, refreshVaultBalances, refreshTotalSupply])

  useEffect(() => {
    if (!custodyEnabled) return
    void refreshGrindersCustody()
  }, [custodyEnabled, refreshGrindersCustody])

  const value = useMemo<GraiDataContextValue>(
    () => ({
      assets,
      assetsLoading,
      assetsError,
      isRegistryLoaded,
      isWalletReady,
      vaultBalances,
      vaultBalancesLoading,
      vaultBalancesError,
      totalSupplyLabel,
      totalSupplyLoading,
      totalSupplyError,
      grindersCustodyRows,
      grindersCustodyLoading,
      grindersCustodyError,
      refreshAssets,
      refreshVaultBalances,
      refreshTotalSupply,
      refreshGrindersCustody,
      requestGrindersCustody,
    }),
    [
      assets,
      assetsLoading,
      assetsError,
      isRegistryLoaded,
      isWalletReady,
      vaultBalances,
      vaultBalancesLoading,
      vaultBalancesError,
      totalSupplyLabel,
      totalSupplyLoading,
      totalSupplyError,
      grindersCustodyRows,
      grindersCustodyLoading,
      grindersCustodyError,
      refreshAssets,
      refreshVaultBalances,
      refreshTotalSupply,
      refreshGrindersCustody,
      requestGrindersCustody,
    ],
  )

  return <GraiDataContext.Provider value={value}>{children}</GraiDataContext.Provider>
}

export function useGraiData() {
  const context = useContext(GraiDataContext)
  if (!context) {
    throw new Error('useGraiData must be used within GraiDataProvider')
  }
  return context
}
