import { lazy, Suspense, useMemo, useState } from 'react'
import { useDocumentChartTheme } from '../../chart/useDocumentChartTheme'
import { formatVaultBalanceDisplay } from '../../grai/formatVaultBalance'
import { useGraiDeployment } from '../../grai/GraiDeploymentProvider'
import { USD_SCALE } from '../../grai/tokenomics'
import {
  buildTotalAssetCompositionRows,
  buildVaultCompositionRows,
  getAssetChartColors,
} from '../../grai/vaultComposition'
import { useGraiAssets } from '../../hooks/useGraiAssets'
import { useGraiTotalSupply } from '../../hooks/useGraiTotalSupply'
import { useGraiVaultBalances } from '../../hooks/useGraiVaultBalances'
import { VaultBalanceTableValue } from '../VaultBalanceTableValue'
import { BALANCE_COLUMN_ICONS, MINT_ASSET_SOLSCAN_ICON } from './graiPageIcons'

const GraiNavDonut = lazy(() =>
  import('../GraiNavDonut').then((m) => ({ default: m.GraiNavDonut })),
)
const GraiManageSection = lazy(() =>
  import('../../pages/GraiManagePage').then((m) => ({ default: m.GraiManageSection })),
)

export function GraiAssetsSection({ isManageSectionOpen }: { isManageSectionOpen: boolean }) {
  const chartTheme = useDocumentChartTheme()
  const assetChartColors = useMemo(() => getAssetChartColors(chartTheme), [chartTheme])
  const { solscanTokenUrl } = useGraiDeployment()
  const { assets: mintAssets, isLoading: mintAssetsLoading } = useGraiAssets()
  const { vaultBalances, isLoading: vaultBalancesLoading } = useGraiVaultBalances()
  const { totalSupplyLabel, isLoading: totalSupplyLoading } = useGraiTotalSupply()
  const [isLegendTableHidden, setIsLegendTableHidden] = useState(false)

  const compositionRows = useMemo(
    () => buildVaultCompositionRows(mintAssets, vaultBalances, 'seniorUsdRaw', assetChartColors),
    [mintAssets, vaultBalances, assetChartColors],
  )
  const juniorCompositionRows = useMemo(
    () => buildVaultCompositionRows(mintAssets, vaultBalances, 'juniorUsdRaw', assetChartColors),
    [mintAssets, vaultBalances, assetChartColors],
  )
  const supplyCompositionRows = useMemo(
    () => buildTotalAssetCompositionRows(mintAssets, vaultBalances, assetChartColors),
    [mintAssets, vaultBalances, assetChartColors],
  )
  const allocatedCompositionRows = useMemo(
    () => buildVaultCompositionRows(mintAssets, vaultBalances, 'allocatedUsdRaw', assetChartColors),
    [mintAssets, vaultBalances, assetChartColors],
  )
  const totalNavUsdRaw = compositionRows.reduce((sum, row) => sum + row.navUsdRaw, 0n)
  const totalJuniorUsdRaw = juniorCompositionRows.reduce((sum, row) => sum + row.navUsdRaw, 0n)
  const totalAllocatedUsdRaw = allocatedCompositionRows.reduce((sum, row) => sum + row.navUsdRaw, 0n)
  const totalNavLabel =
    vaultBalancesLoading || mintAssetsLoading
      ? '…'
      : formatVaultBalanceDisplay(totalNavUsdRaw, USD_SCALE, 2)
  const totalJuniorNavLabel =
    vaultBalancesLoading || mintAssetsLoading
      ? '…'
      : formatVaultBalanceDisplay(totalJuniorUsdRaw, USD_SCALE, 2)
  const totalAllocatedNavLabel =
    vaultBalancesLoading || mintAssetsLoading
      ? '…'
      : formatVaultBalanceDisplay(totalAllocatedUsdRaw, USD_SCALE, 2)

  return (
    <aside className="grai-assets-chart-card" id="grai-assets-section" aria-label="GRAI assets composition">
      <div className="grai-assets-split">
        <div className="grai-assets-composition-block">
          <Suspense fallback={null}>
            <div className="grai-donut-slot grai-donut-slot--supply" aria-label="GRAI total supply">
              <GraiNavDonut
                slices={supplyCompositionRows}
                totalNavLabel={totalSupplyLoading ? '…' : totalSupplyLabel}
                centerLabel="Total Supply"
                valueUnit="GRAI"
                isLoading={totalSupplyLoading || vaultBalancesLoading || mintAssetsLoading}
              />
            </div>
            <div className="grai-donut-slot grai-donut-slot--senior">
              <GraiNavDonut
                slices={compositionRows}
                totalNavLabel={totalNavLabel}
                centerLabel="Senior Vault NAV"
                isLoading={vaultBalancesLoading || mintAssetsLoading}
              />
            </div>
            <div className="grai-donut-slot grai-donut-slot--junior">
              <GraiNavDonut
                slices={juniorCompositionRows}
                totalNavLabel={totalJuniorNavLabel}
                centerLabel="Junior Vault NAV"
                isLoading={vaultBalancesLoading || mintAssetsLoading}
              />
            </div>
            <div className="grai-donut-slot grai-donut-slot--allocated" aria-label="Allocated NAV">
              <GraiNavDonut
                slices={allocatedCompositionRows}
                totalNavLabel={totalAllocatedNavLabel}
                centerLabel="Allocated NAV"
                isLoading={vaultBalancesLoading || mintAssetsLoading}
              />
            </div>
          </Suspense>
          <div className="grai-vault-balance-shell">
            <div className="grai-vault-balance-table-scroll">
              <div
                className="grai-balance-table"
                id="grai-vault-balance-table"
                aria-label="Asset balances by vault"
              >
                <div className="grai-balance-table-row grai-balance-table-row--head">
                  <div className="grai-balance-table-cell grai-balance-table-cell--head grai-balance-table-cell--asset is-asset">
                    <span className="grai-balance-table-col-icon">{BALANCE_COLUMN_ICONS.assets}</span>
                    Assets
                  </div>
                  <div className="grai-balance-table-cell grai-balance-table-cell--head is-senior">
                    <span className="grai-balance-table-col-icon">{BALANCE_COLUMN_ICONS.seniorVault}</span>
                    Senior Vault
                  </div>
                  <div className="grai-balance-table-cell grai-balance-table-cell--head is-junior">
                    <span className="grai-balance-table-col-icon">{BALANCE_COLUMN_ICONS.juniorVault}</span>
                    Junior Vault
                  </div>
                  <div className="grai-balance-table-cell grai-balance-table-cell--head is-allocated">
                    <span className="grai-balance-table-col-icon">{BALANCE_COLUMN_ICONS.allocated}</span>
                    Allocated
                  </div>
                </div>
                <div
                  className={`grai-vault-balance-body-panel${isLegendTableHidden ? '' : ' is-open'}`}
                  aria-hidden={isLegendTableHidden}
                >
                  <div className="grai-vault-balance-body-panel-inner">
                    <div className="grai-vault-balance-body-grid">
                      {mintAssetsLoading ? (
                        <div className="grai-balance-table-row">
                          <div className="grai-balance-table-cell grai-balance-table-cell--asset grai-asset-cell">
                            Loading assets…
                          </div>
                          <div className="grai-balance-table-cell grai-balance-table-value">—</div>
                          <div className="grai-balance-table-cell grai-balance-table-value">—</div>
                          <div className="grai-balance-table-cell grai-balance-table-value">—</div>
                        </div>
                      ) : compositionRows.length === 0 ? (
                        <div className="grai-balance-table-row">
                          <div className="grai-balance-table-cell grai-balance-table-cell--asset grai-asset-cell">
                            No registry assets
                          </div>
                          <div className="grai-balance-table-cell grai-balance-table-value">—</div>
                          <div className="grai-balance-table-cell grai-balance-table-value">—</div>
                          <div className="grai-balance-table-cell grai-balance-table-value">—</div>
                        </div>
                      ) : (
                        compositionRows.map((row) => (
                          <div className="grai-balance-table-row" key={row.asset.mint}>
                            <div className="grai-balance-table-cell grai-balance-table-cell--asset grai-asset-cell">
                              <span className="grai-asset-cell-token">
                                <span className="grai-asset-cell-icon" aria-hidden="true">
                                  <img src={row.asset.icon.src} alt={row.asset.icon.alt} />
                                </span>
                                {row.asset.symbol}
                                <a
                                  href={solscanTokenUrl(row.asset.mint)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="grai-mint-asset-value-solscan grai-asset-cell-solscan"
                                  aria-label={`View ${row.asset.symbol} on Solscan`}
                                  title={`View ${row.asset.symbol} on Solscan`}
                                >
                                  {MINT_ASSET_SOLSCAN_ICON}
                                </a>
                              </span>
                            </div>
                            <div className="grai-balance-table-cell grai-balance-table-value">
                              <VaultBalanceTableValue
                                amount={row.senior}
                                usdRaw={row.seniorUsdRaw}
                                isLoading={vaultBalancesLoading}
                              />
                            </div>
                            <div className="grai-balance-table-cell grai-balance-table-value">
                              <VaultBalanceTableValue
                                amount={row.junior}
                                usdRaw={row.juniorUsdRaw}
                                isLoading={vaultBalancesLoading}
                              />
                            </div>
                            <div className="grai-balance-table-cell grai-balance-table-value">
                              <VaultBalanceTableValue
                                amount={row.allocated}
                                usdRaw={row.allocatedUsdRaw}
                                isLoading={vaultBalancesLoading}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="grai-vault-balance-toggle">
              <button
                type="button"
                className={`grai-donut-legend-toggle grai-vault-balance-show-toggle ${isLegendTableHidden ? 'is-collapsed' : ''}`}
                onClick={() => setIsLegendTableHidden((hidden) => !hidden)}
                aria-expanded={!isLegendTableHidden}
                aria-controls="grai-vault-balance-table"
                aria-label={isLegendTableHidden ? 'View vault balances table' : 'Hide vault balances table'}
              >
                <span className="grai-grinders-section-toggle-inner">
                  <svg
                    className="grai-donut-legend-toggle-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                  <span className="grai-grinders-section-toggle-label" aria-hidden="true">
                    {isLegendTableHidden ? 'VIEW' : 'HIDE'}
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
        {isManageSectionOpen ? (
          <Suspense fallback={null}>
            <GraiManageSection />
          </Suspense>
        ) : null}
      </div>
    </aside>
  )
}
