import { GraiLiquidationActions } from './GraiLiquidationActions'

export function GraiAssetsSection() {
  return (
    <aside className="grai-assets-chart-card" id="grai-assets-section" aria-label="GRAI assets">
      <div className="grai-assets-split">
        <GraiLiquidationActions />
      </div>
    </aside>
  )
}
