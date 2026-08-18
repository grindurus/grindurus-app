import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  ControlButton,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  MarkerType,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Connection } from '@solana/web3.js'
import { toast } from 'react-toastify'
import type { GraiEvmConfig, GraiSolanaRuntime } from '../../grai/deployments'
import { formatVaultBalanceDisplay } from '../../grai/formatVaultBalance'
import {
  buildExampleReferralForest,
  buildReferralForest,
  fetchEvmReferralBooks,
  type GraiReferralTreeNode,
} from '../../grai/evm/fetchReferralBooks'
import { GRAI_DECIMALS_EVM } from '../../grai/evm/constants'
import { formatClaimUsdTotal } from '../../grai/evm/estimateClaim'
import { executeEvmPoach } from '../../grai/evm/executeTransactions'
import { executePoach } from '../../grai/buildPoachTransaction'
import { fetchSolanaReferralBooks } from '../../grai/fetchSolanaReferralBooks'
import { useGraiTransaction } from '../../hooks/useGraiTransaction'
import { useWalletAssetBalance } from '../../hooks/useWalletAssetBalance'
import { assetUrl } from '../../utils/appPaths'
import { navigateToGraiSection } from '../../utils/graiNavigation'
import { playBullSound } from '../../utils/playBullSound'
import { GraiActionConnectWalletButton } from './GraiWalletAction'

type Props = {
  evmProtocol: GraiEvmConfig | null
  /** When set with a live Solana deployment, loads on-chain referral books / poach. */
  solana?: GraiSolanaRuntime | null
  connection?: Connection | null
  highlightAddress?: string | null
  graiDecimals?: number
  layout?: 'dashboard' | 'graph-only'
  selectedLockerId?: string | null
  onSelectLocker?: (lockerId: string | null) => void
  /** Pending claim USD (`USD_SCALE`) keyed by locker. Claim graph only. */
  claimUsdByLocker?: Record<string, bigint>
}

/** EVM addresses are case-insensitive; Solana base58 must stay exact. */
function addressKey(address: string): string {
  return address.startsWith('0x') || address.startsWith('0X') ? address.toLowerCase() : address
}

function addressesEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return addressKey(a) === addressKey(b)
}

function isOwnLocker(wallet: string | null | undefined, locker: string): boolean {
  return Boolean(wallet) && addressesEqual(wallet, locker)
}

/** Graph root: no parent edge drawn above this locker. */
function isForestRoot(forest: GraiReferralTreeNode[], locker: string): boolean {
  return forest.some((root) => addressesEqual(root.locker, locker))
}

function findTreeNode(
  forest: GraiReferralTreeNode[],
  locker: string,
): GraiReferralTreeNode | null {
  for (const node of forest) {
    if (addressesEqual(node.locker, locker) || addressesEqual(node.owner, locker)) return node
    const nested = findTreeNode(node.children, locker)
    if (nested) return nested
  }
  return null
}

function lockerInSubtree(node: GraiReferralTreeNode, locker: string): boolean {
  if (addressesEqual(node.locker, locker)) return true
  return node.children.some((child) => lockerInSubtree(child, locker))
}

/** Direct or deeper downline of the connected wallet — protocol `AlreadyBound` / own tree. */
function isOwnReferral(
  forest: GraiReferralTreeNode[],
  wallet: string | null | undefined,
  locker: GraiReferralTreeNode,
): boolean {
  if (!wallet) return false
  if (addressesEqual(wallet, locker.referrer)) return true
  const seat = findTreeNode(forest, wallet)
  if (!seat) return false
  return seat.children.some((child) => lockerInSubtree(child, locker.locker))
}

type ReferralNodeData = {
  locker: string
  owner: string
  label: string
  value: bigint
  l1Value: bigint
  l2Value: bigint
  depth: number
  isYou: boolean
  isRoot: boolean
  decimals: number
  selected: boolean
  showClaimUsd: boolean
  claimUsdLabel: string | null
}

const NODE_WIDTH = 208
const NODE_HEIGHT = 118
const GAP_X = 56
const GAP_Y = 88
const EDGE_STEP_OFFSET = 40
const COLORS = {
  own: '#ff69b4',
  l1: '#22c55e',
  l2: '#c9a227',
  edge: 'rgba(255, 105, 180, 0.55)',
}

function shortAddress(address: string): string {
  if (address.length < 12) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function formatBook(raw: bigint, decimals: number): string {
  return `$${formatVaultBalanceDisplay(raw, decimals, 2)}`
}

function formatGraiAmount(raw: bigint, decimals: number): string {
  return formatVaultBalanceDisplay(raw, decimals, 2)
}

function lookupClaimUsd(
  claimUsdByLocker: Record<string, bigint> | undefined,
  locker: string,
): bigint | null {
  if (!claimUsdByLocker) return null
  const direct = claimUsdByLocker[locker] ?? claimUsdByLocker[addressKey(locker)]
  if (direct != null) return direct
  const lowered = locker.toLowerCase()
  if (lowered in claimUsdByLocker) return claimUsdByLocker[lowered]!
  return Object.keys(claimUsdByLocker).length === 0 ? null : 0n
}

function toNumber(raw: bigint, decimals: number): number {
  const scale = 10 ** Math.min(decimals, 8)
  const truncated = raw / 10n ** BigInt(Math.max(0, decimals - Math.min(decimals, 8)))
  return Number(truncated) / scale
}

function subtreeLeafCount(node: GraiReferralTreeNode): number {
  if (node.children.length === 0) return 1
  return node.children.reduce((sum, child) => sum + subtreeLeafCount(child), 0)
}

function layoutForest(
  forest: GraiReferralTreeNode[],
  highlight: string | null | undefined,
  decimals: number,
  selectedId: string | null,
  claimUsdByLocker?: Record<string, bigint>,
): { nodes: Node<ReferralNodeData>[]; edges: Edge[] } {
  const nodes: Node<ReferralNodeData>[] = []
  const edges: Edge[] = []
  const parentOf = new Map<string, string>()
  let rootOffsetX = 0

  const place = (node: GraiReferralTreeNode, depth: number, leftX: number, parentId?: string) => {
    const leaves = subtreeLeafCount(node)
    const blockWidth = leaves * (NODE_WIDTH + GAP_X) - GAP_X
    const x = leftX + blockWidth / 2 - NODE_WIDTH / 2
    const y = depth * (NODE_HEIGHT + GAP_Y)
    const id = addressKey(node.locker)
    const isYou = Boolean(highlight) && addressesEqual(id, highlight)

    if (parentId) parentOf.set(id, parentId)

    const claimUsdRaw = lookupClaimUsd(claimUsdByLocker, node.locker)

    nodes.push({
      id,
      type: 'referral',
      position: { x, y },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      style: { width: NODE_WIDTH, height: NODE_HEIGHT },
      data: {
        locker: node.locker,
        owner: node.owner,
        label: 'Locker',
        value: node.value,
        l1Value: node.l1Value,
        l2Value: node.l2Value,
        depth,
        isYou,
        isRoot: depth === 0,
        decimals,
        selected: selectedId === id,
        showClaimUsd: claimUsdByLocker != null,
        claimUsdLabel: claimUsdRaw == null ? null : formatClaimUsdTotal(claimUsdRaw),
      },
      draggable: true,
    })

    let childLeft = leftX
    for (const child of node.children) {
      const childLeaves = subtreeLeafCount(child)
      const childBlock = childLeaves * (NODE_WIDTH + GAP_X) - GAP_X
      place(child, depth + 1, childLeft, id)
      childLeft += childBlock + GAP_X
    }
  }

  for (const root of forest) {
    const leaves = subtreeLeafCount(root)
    const blockWidth = leaves * (NODE_WIDTH + GAP_X) - GAP_X
    place(root, 0, rootOffsetX)
    rootOffsetX += blockWidth + GAP_X * 2
  }

  /** Highlight at most two hops upline (L1 + L2 referrers). */
  const highlightEdgeIds = new Set<string>()
  if (selectedId) {
    let cur: string | undefined = selectedId
    for (let hop = 0; hop < 2 && cur && parentOf.has(cur); hop++) {
      const parent: string = parentOf.get(cur)!
      highlightEdgeIds.add(`${cur}->${parent}`)
      cur = parent
    }
  }

  for (const [childId, parentId] of parentOf) {
    const edgeId = `${childId}->${parentId}`
    const onPath = highlightEdgeIds.has(edgeId)
    edges.push({
      id: edgeId,
      // Flow points upline: recruit → referrer (arrow at parent).
      source: childId,
      target: parentId,
      type: 'step',
      pathOptions: { borderRadius: 0, offset: EDGE_STEP_OFFSET },
      animated: onPath,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: onPath ? COLORS.own : COLORS.edge,
        width: 16,
        height: 16,
      },
      style: onPath
        ? {
            stroke: COLORS.own,
            strokeWidth: 2.4,
            strokeDasharray: '6 4',
          }
        : {
            stroke: COLORS.edge,
            strokeWidth: 2,
          },
    } as Edge)
  }

  return { nodes, edges }
}

function flattenForest(forest: GraiReferralTreeNode[]): GraiReferralTreeNode[] {
  const out: GraiReferralTreeNode[] = []
  const walk = (nodes: GraiReferralTreeNode[]) => {
    for (const node of nodes) {
      out.push(node)
      walk(node.children)
    }
  }
  walk(forest)
  return out
}

const ReferralGraphNode = memo(function ReferralGraphNode({ data }: { data: ReferralNodeData }) {
  return (
    <div
      className={`grai-referral-graph-node${data.isRoot ? ' is-root' : ''}${data.isYou ? ' is-you' : ''}${
        data.selected ? ' is-selected' : ''
      }`}
      style={{
        border: data.selected
          ? '1px solid #ff69b4'
          : '1px solid rgba(255, 105, 180, 0.45)',
        boxShadow: 'none',
        outline: 'none',
        background: 'transparent',
      }}
    >
      <Handle type="source" position={Position.Top} className="grai-referral-graph-handle" />
      <header className="grai-referral-graph-node-head">
        <span className="grai-referral-graph-node-name">
          Locker <GraphCopyAddress address={data.locker} />
        </span>
        {data.isYou ? <span className="grai-referral-graph-badge">You</span> : null}
        {data.isRoot ? <span className="grai-referral-graph-badge is-root">Root</span> : null}
      </header>
      <p className="grai-referral-graph-node-owner">
        <span className="grai-referral-graph-node-owner-label">Owner:</span>{' '}
        <GraphCopyAddress address={data.owner} />
      </p>
      {data.showClaimUsd ? (
        <>
          <div className="grai-referral-graph-node-bars" aria-hidden="true">
            <span style={{ width: data.claimUsdLabel ? '100%' : '0%', background: COLORS.own }} />
          </div>
          <dl className="grai-referral-graph-node-stats is-claim">
            <div>
              <dt>Claimable</dt>
              <dd>{data.claimUsdLabel ?? '…'}</dd>
            </div>
          </dl>
        </>
      ) : (
        <>
      <div className="grai-referral-graph-node-bars" aria-hidden="true">
        <span style={{ width: '100%', background: COLORS.own }} />
        <span
          style={{
            width: `${Math.min(100, Number((data.l1Value * 100n) / (data.value > 0n ? data.value : 1n)))}%`,
            background: COLORS.l1,
          }}
        />
        <span
          style={{
            width: `${Math.min(100, Number((data.l2Value * 100n) / (data.value > 0n ? data.value : 1n)))}%`,
            background: COLORS.l2,
          }}
        />
      </div>
      <dl className="grai-referral-graph-node-stats">
        <div>
          <dt>Own</dt>
          <dd>{formatBook(data.value, data.decimals)}</dd>
        </div>
        <div>
          <dt>L1</dt>
          <dd>{formatBook(data.l1Value, data.decimals)}</dd>
        </div>
        <div>
          <dt>L2</dt>
          <dd>{formatBook(data.l2Value, data.decimals)}</dd>
        </div>
      </dl>
        </>
      )}
      <Handle type="target" position={Position.Bottom} className="grai-referral-graph-handle" />
    </div>
  )
})

const nodeTypes: NodeTypes = { referral: ReferralGraphNode }

function GraphCopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      className={`grai-referral-graph-node-addr nodrag nopan${copied ? ' is-copied' : ''}`}
      title={copied ? 'Copied!' : address}
      aria-label={copied ? 'Copied!' : `Copy ${address}`}
      onClick={(event) => {
        event.stopPropagation()
        void navigator.clipboard.writeText(address).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1000)
        }).catch(() => {
          // ignore clipboard errors
        })
      }}
    >
      {copied ? 'Copied!' : shortAddress(address)}
    </button>
  )
}

function GraphArrowSample({ dashed }: { dashed?: boolean }) {
  const stroke = dashed ? COLORS.own : COLORS.edge
  return (
    <svg
      className="grai-referral-dash-graph-legend-arrow"
      viewBox="0 0 44 12"
      width="44"
      height="12"
      aria-hidden="true"
    >
      <line
        x1="1"
        y1="6"
        x2="32"
        y2="6"
        fill="none"
        stroke={stroke}
        strokeWidth={dashed ? 2.4 : 2}
        strokeDasharray={dashed ? '6 4' : undefined}
        strokeLinecap="round"
      />
      <polygon points="31,2.2 42,6 31,9.8" fill={stroke} />
    </svg>
  )
}

function GraphArrowLegend({
  open,
  onToggle,
}: {
  open: boolean
  onToggle: () => void
}) {
  return (
    <Panel position="top-left" className="grai-referral-dash-graph-legend-panel nodrag nopan">
      <button
        type="button"
        className={`grai-referral-dash-graph-legend-btn${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-controls="grai-referral-graph-legend"
        onClick={onToggle}
      >
        Legend
      </button>
      {open ? (
        <div id="grai-referral-graph-legend" className="grai-referral-dash-graph-legend-card" role="note">
          <div className="grai-referral-dash-graph-legend-row">
            <GraphArrowSample />
            <span>Solid: locker → referrer</span>
          </div>
          <div className="grai-referral-dash-graph-legend-row">
            <GraphArrowSample dashed />
            <span>Dashed: revshare to this upline</span>
          </div>
        </div>
      ) : null}
    </Panel>
  )
}

function FitHomeControlButton() {
  const { fitView } = useReactFlow()
  return (
    <ControlButton
      className="react-flow__controls-fitview grai-referral-dash-fit-home"
      onClick={() => {
        void fitView({ padding: 0.18 })
      }}
      title="Fit View"
      aria-label="Fit View"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
        <path d="M9 21v-7h6v7" />
      </svg>
    </ControlButton>
  )
}

function FindLockerControlButton({
  open,
  onToggle,
}: {
  open: boolean
  onToggle: () => void
}) {
  return (
    <ControlButton
      className={`grai-referral-dash-find${open ? ' is-open' : ''}`}
      onClick={onToggle}
      title="Find locker"
      aria-label="Find locker"
      aria-pressed={open}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    </ControlButton>
  )
}

function FindLockerInputBar({
  open,
  onClose,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  onSelect: (id: string) => void
}) {
  const { getNodes, setCenter, getZoom } = useReactFlow()
  const [query, setQuery] = useState('')
  const [notFound, setNotFound] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setNotFound(false)
      return
    }
    inputRef.current?.focus()
  }, [open])

  const submit = useCallback(() => {
    const q = query.trim()
    if (!q) return
    const qLower = q.toLowerCase()
    const nodes = getNodes()
    const match = nodes.find((node) => {
      const locker = node.id
      const owner = (node.data as ReferralNodeData).owner
      return (
        locker.includes(q) ||
        locker.toLowerCase().includes(qLower) ||
        owner.includes(q) ||
        owner.toLowerCase().includes(qLower)
      )
    })
    if (!match) {
      setNotFound(true)
      return
    }
    setNotFound(false)
    onSelect(match.id)
    const width = match.measured?.width ?? match.width ?? NODE_WIDTH
    const height = match.measured?.height ?? match.height ?? NODE_HEIGHT
    void setCenter(match.position.x + width / 2, match.position.y + height / 2, {
      zoom: Math.max(getZoom(), 0.9),
      duration: 420,
    })
    onClose()
  }, [getNodes, getZoom, onClose, onSelect, query, setCenter])

  if (!open) return null

  return (
    <Panel position="bottom-left" className="grai-referral-dash-find-bar">
      <div className="grai-referral-dash-find-field">
        <input
          ref={inputRef}
          type="search"
          className="grai-referral-dash-find-input"
          value={query}
          placeholder="Locker address"
          autoComplete="off"
          spellCheck={false}
          aria-label="Locker address"
          onChange={(event) => {
            setQuery(event.target.value)
            setNotFound(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
            if (event.key === 'Escape') onClose()
          }}
        />
        {notFound ? (
          <p className="grai-referral-dash-find-note" role="status">
            No locker found
          </p>
        ) : null}
      </div>
    </Panel>
  )
}

function MeControlButton({
  address,
  onSelect,
}: {
  address?: string | null
  onSelect: (id: string) => void
}) {
  const { getNode, setCenter, getZoom } = useReactFlow()
  const targetId = address ? addressKey(address) : null

  return (
    <ControlButton
      className="grai-referral-dash-me"
      disabled={!targetId}
      onClick={() => {
        if (!targetId) return
        const node = getNode(targetId)
        if (!node) return
        onSelect(targetId)
        const width = node.measured?.width ?? node.width ?? NODE_WIDTH
        const height = node.measured?.height ?? node.height ?? NODE_HEIGHT
        void setCenter(node.position.x + width / 2, node.position.y + height / 2, {
          zoom: Math.max(getZoom(), 0.9),
          duration: 420,
        })
      }}
      title={targetId ? 'Focus my locker' : 'Connect wallet to focus your locker'}
      aria-label="Focus my locker"
    >
      <span className="grai-referral-dash-me-label">ME</span>
    </ControlButton>
  )
}

export function GraiReferralTree({
  evmProtocol,
  solana = null,
  connection = null,
  highlightAddress,
  graiDecimals = GRAI_DECIMALS_EVM,
  layout = 'dashboard',
  selectedLockerId,
  onSelectLocker,
  claimUsdByLocker,
}: Props) {
  const { run: runSolanaTx } = useGraiTransaction()
  const isSelectionControlled = onSelectLocker != null
  const [forest, setForest] = useState<GraiReferralTreeNode[]>([])
  const [isExample, setIsExample] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uncontrolledSelectedId, setUncontrolledSelectedId] = useState<string | null>(null)
  const selectedId = isSelectionControlled
    ? (selectedLockerId ? addressKey(selectedLockerId) : null)
    : uncontrolledSelectedId

  const updateSelectedId = useCallback(
    (id: string | null) => {
      const normalized = id ? addressKey(id) : null
      if (isSelectionControlled) {
        onSelectLocker?.(normalized)
      } else {
        setUncontrolledSelectedId(normalized)
      }
    },
    [isSelectionControlled, onSelectLocker],
  )

  const [sideView, setSideView] = useState<'total' | 'top'>('total')
  const [topPage, setTopPage] = useState(0)
  const [minimapOpen, setMinimapOpen] = useState(false)
  const [finderOpen, setFinderOpen] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const [isPoaching, setIsPoaching] = useState(false)
  const [mapRequested, setMapRequested] = useState(true)
  const [isLoadingMap, setIsLoadingMap] = useState(false)
  const [isDashCollapsed, setIsDashCollapsed] = useState(false)
  const chartHostRef = useRef<HTMLDivElement | null>(null)

  const disarmChartFocus = useCallback(() => {
    const host = chartHostRef.current
    if (!host) return
    host.querySelectorAll<SVGElement>('.recharts-surface').forEach((el) => {
      if (el.getAttribute('tabindex') !== '-1') el.setAttribute('tabindex', '-1')
      if (el.hasAttribute('role')) el.removeAttribute('role')
      if (typeof el.blur === 'function' && document.activeElement === el) el.blur()
    })
  }, [])

  useLayoutEffect(() => {
    disarmChartFocus()
    const host = chartHostRef.current
    if (!host || typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(() => {
      disarmChartFocus()
    })
    observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['tabindex', 'role'] })
    return () => observer.disconnect()
  }, [disarmChartFocus, selectedId, sideView, topPage])

  const reloadForest = useCallback(async () => {
    const hasSolana = Boolean(connection && solana)
    const hasEvm = Boolean(evmProtocol?.protocolAddress || evmProtocol?.graiToken)

    if (!hasSolana && !hasEvm) {
      setForest(buildExampleReferralForest())
      setIsExample(true)
      setError(null)
      return
    }

    setError(null)
    setIsLoadingMap(true)
    try {
      const rows = hasSolana
        ? await fetchSolanaReferralBooks(connection!, solana!.graiMint, {
            onPartial: (partial) => {
              if (partial.length === 0) return
              setForest(buildReferralForest(partial))
              setIsExample(false)
              setIsLoadingMap(false)
            },
          })
        : await fetchEvmReferralBooks(evmProtocol!)
      if (rows.length === 0) {
        setForest(buildExampleReferralForest())
        setIsExample(true)
        return
      }
      setForest(buildReferralForest(rows))
      setIsExample(false)
    } catch (err) {
      setForest(buildExampleReferralForest())
      setIsExample(true)
      setError(err instanceof Error ? err.message : 'Failed to load referral tree')
    } finally {
      setIsLoadingMap(false)
    }
  }, [connection, evmProtocol, solana])

  const startMapLoad = useCallback(() => {
    if (isLoadingMap) return
    if (mapRequested) {
      void reloadForest()
      return
    }
    setMapRequested(true)
  }, [isLoadingMap, mapRequested, reloadForest])

  useEffect(() => {
    if (!mapRequested) return
    void reloadForest()
  }, [mapRequested, reloadForest])

  useEffect(() => {
    if (isSelectionControlled) return
    if (!highlightAddress) return
    const key = addressKey(highlightAddress)
    const flatNodes = flattenForest(forest)
    if (flatNodes.some((node) => addressKey(node.locker) === key)) {
      updateSelectedId(key)
    }
  }, [forest, highlightAddress, isSelectionControlled, updateSelectedId])

  const flat = useMemo(() => flattenForest(forest), [forest])

  const totals = useMemo(() => {
    let own = 0n
    let l1 = 0n
    let l2 = 0n
    for (const node of flat) {
      own += node.value
      l1 += node.l1Value
      l2 += node.l2Value
    }
    return { own, l1, l2, lockers: flat.length, roots: forest.length }
  }, [flat, forest.length])

  const { nodes, edges } = useMemo(
    () => layoutForest(forest, highlightAddress, graiDecimals, selectedId, claimUsdByLocker),
    [forest, highlightAddress, graiDecimals, selectedId, claimUsdByLocker],
  )

  const selected = useMemo(
    () => flat.find((node) => addressKey(node.locker) === selectedId) ?? null,
    [flat, selectedId],
  )

  const poachAsk = selected ? selected.value + selected.l1Value : 0n
  const poachSellerLabel = useMemo(() => {
    if (!selected) return null
    return shortAddress(selected.referrer)
  }, [selected])

  const liveChainReady = Boolean(connection && solana) || Boolean(evmProtocol)
  const walletChainLabel = connection && solana ? 'Solana' : 'EVM'
  const graiMintAddress = solana?.graiMint.toBase58() ?? evmProtocol?.graiToken ?? undefined
  const {
    raw: walletGraiRaw,
    isLoading: isGraiBalanceLoading,
    isConnected: isGraiWalletConnected,
  } = useWalletAssetBalance(graiMintAddress, 'GRAI')

  const cannotPoachOwnRoot = Boolean(
    selected &&
      highlightAddress &&
      isOwnLocker(highlightAddress, selected.locker) &&
      isForestRoot(forest, selected.locker),
  )
  const cannotPoachOwnReferral = Boolean(
    selected && highlightAddress && isOwnReferral(forest, highlightAddress, selected),
  )

  const needsGraiDeposit = Boolean(
    selected &&
      highlightAddress &&
      !isExample &&
      liveChainReady &&
      poachAsk > 0n &&
      !cannotPoachOwnRoot &&
      !cannotPoachOwnReferral &&
      isGraiWalletConnected &&
      !isGraiBalanceLoading &&
      walletGraiRaw < poachAsk,
  )

  const poachBlockedReason = useMemo(() => {
    if (!selected) return null
    if (isExample || !liveChainReady) return 'Demo tree — live poach needs on-chain books'
    if (!highlightAddress) return `Connect a ${walletChainLabel} wallet to poach`
    if (cannotPoachOwnRoot) {
      return 'You already sit at this root — there is no upline to poach'
    }
    if (cannotPoachOwnReferral) {
      return 'You cannot poach your own referrals'
    }
    if (poachAsk <= 0n) return 'Poach ask is zero'
    if (needsGraiDeposit) return 'Not enough GRAI in your wallet'
    return null
  }, [
    selected,
    isExample,
    liveChainReady,
    highlightAddress,
    poachAsk,
    walletChainLabel,
    needsGraiDeposit,
    cannotPoachOwnRoot,
    cannotPoachOwnReferral,
  ])

  const onPoach = useCallback(async () => {
    if (!selected || poachBlockedReason) return
    const toastId = toast.loading(`Poaching ${shortAddress(selected.locker)}…`)
    setIsPoaching(true)
    try {
      if (connection && solana) {
        const result = await runSolanaTx({
          connectMessage: 'Connect a Solana wallet to poach',
          clusterAction: 'poach a referral slot',
          failureMessage: 'Poach transaction failed',
          execute: ({ connection: conn, solana: runtime, publicKey, signTransaction }) =>
            executePoach({
              connection: conn,
              config: runtime,
              poacher: publicKey,
              locker: selected.locker,
              signTransaction,
            }),
        })
        toast.update(toastId, {
          render: `Poached for ${formatVaultBalanceDisplay(result.price, graiDecimals, 2)} GRAI`,
          type: 'success',
          isLoading: false,
          autoClose: 5000,
        })
      } else if (evmProtocol) {
        const result = await executeEvmPoach({
          config: evmProtocol,
          locker: selected.locker as `0x${string}`,
        })
        toast.update(toastId, {
          render: `Poached for ${formatVaultBalanceDisplay(result.price, graiDecimals, 2)} GRAI`,
          type: 'success',
          isLoading: false,
          autoClose: 5000,
        })
      } else {
        throw new Error('No live protocol configured for poach')
      }
      void playBullSound()
      await reloadForest()
    } catch (err) {
      toast.update(toastId, {
        render: err instanceof Error ? err.message : 'Poach failed',
        type: 'error',
        isLoading: false,
        autoClose: 7000,
      })
    } finally {
      setIsPoaching(false)
    }
  }, [
    selected,
    poachBlockedReason,
    connection,
    solana,
    evmProtocol,
    graiDecimals,
    reloadForest,
    runSolanaTx,
  ])

  const selectedBars = useMemo(() => {
    if (!selected) return []
    return [
      { name: 'Own', value: toNumber(selected.value, graiDecimals), fill: COLORS.own },
      { name: 'L1', value: toNumber(selected.l1Value, graiDecimals), fill: COLORS.l1 },
      { name: 'L2', value: toNumber(selected.l2Value, graiDecimals), fill: COLORS.l2 },
    ]
  }, [selected, graiDecimals])

  const mixPie = useMemo(() => {
    const own = toNumber(totals.own, graiDecimals)
    const l1 = toNumber(totals.l1, graiDecimals)
    const l2 = toNumber(totals.l2, graiDecimals)
    return [
      { name: 'Own books', value: own, fill: COLORS.own },
      { name: 'L1 books', value: l1, fill: COLORS.l1 },
      { name: 'L2 books', value: l2, fill: COLORS.l2 },
    ].filter((row) => row.value > 0)
  }, [totals, graiDecimals])

  const TOP_PAGE_SIZE = 6

  const topLockersAll = useMemo(() => {
    return [...flat]
      .sort((a, b) => (b.value > a.value ? 1 : b.value < a.value ? -1 : 0))
      .map((node) => ({
        id: addressKey(node.locker),
        name: shortAddress(node.locker),
        own: toNumber(node.value, graiDecimals),
        l1: toNumber(node.l1Value, graiDecimals),
        l2: toNumber(node.l2Value, graiDecimals),
      }))
  }, [flat, graiDecimals])

  const topPageCount = Math.max(1, Math.ceil(topLockersAll.length / TOP_PAGE_SIZE))

  useEffect(() => {
    setTopPage(0)
  }, [topLockersAll.length, sideView])

  useEffect(() => {
    if (topPage >= topPageCount) setTopPage(Math.max(0, topPageCount - 1))
  }, [topPage, topPageCount])

  const topLockers = useMemo(() => {
    const start = topPage * TOP_PAGE_SIZE
    return topLockersAll.slice(start, start + TOP_PAGE_SIZE)
  }, [topLockersAll, topPage])

  const topRangeLabel = useMemo(() => {
    if (topLockersAll.length === 0) return '0'
    const start = topPage * TOP_PAGE_SIZE + 1
    const end = Math.min(topLockersAll.length, (topPage + 1) * TOP_PAGE_SIZE)
    return `${start}–${end} of ${topLockersAll.length}`
  }, [topLockersAll.length, topPage])

  const onNodeClick = useCallback<NodeMouseHandler<Node<ReferralNodeData>>>(
    (_event, node) => {
      updateSelectedId(node.id)
    },
    [updateSelectedId],
  )

  const onPaneClick = useCallback(() => {
    updateSelectedId(null)
  }, [updateSelectedId])

  const selectLockerFromChart = useCallback(
    (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return
      const id = (payload as { id?: unknown }).id
      if (typeof id === 'string' && id.length > 0) updateSelectedId(id)
    },
    [updateSelectedId],
  )

  const onTopBarClick = useCallback(
    (data: unknown) => {
      if (!data || typeof data !== 'object') return
      const payload = (data as { payload?: unknown }).payload ?? data
      selectLockerFromChart(payload)
    },
    [selectLockerFromChart],
  )

  const onTopAxisTickClick = useCallback(
    (lockerId: string) => {
      updateSelectedId(lockerId)
    },
    [updateSelectedId],
  )

  const showLoadOverlay = layout !== 'graph-only' && (!mapRequested || (isLoadingMap && forest.length === 0))

  const graphPanel = (
    <div className="grai-referral-dash-graph" aria-label="Referral graph">
      {showLoadOverlay ? (
        <div className="grai-referral-dash-graph-load" role="status" aria-live="polite">
          <span className="grai-referral-dash-graph-load-spinner" aria-hidden />
          Loading...
        </div>
      ) : (
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.35}
        maxZoom={1.6}
        nodesConnectable={false}
        edgesFocusable={false}
        proOptions={{ hideAttribution: true }}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
      >
        <Background gap={20} size={1} color="rgba(148, 163, 184, 0.12)" />
        <GraphArrowLegend
          open={legendOpen}
          onToggle={() => setLegendOpen((open) => !open)}
        />
        <Controls showInteractive={false} showFitView={false}>
          <MeControlButton address={highlightAddress} onSelect={updateSelectedId} />
          <FitHomeControlButton />
          <FindLockerControlButton
            open={finderOpen}
            onToggle={() => setFinderOpen((open) => !open)}
          />
        </Controls>
        <FindLockerInputBar
          open={finderOpen}
          onClose={() => setFinderOpen(false)}
          onSelect={updateSelectedId}
        />
        <Panel position="bottom-right" className="grai-referral-dash-minimap-panel">
          <button
            type="button"
            className={`grai-referral-dash-minimap-toggle${minimapOpen ? ' is-open' : ''}`}
            aria-label={minimapOpen ? 'Hide minimap' : 'Show minimap'}
            aria-pressed={minimapOpen}
            title="Minimap"
            onClick={() => setMinimapOpen((open) => !open)}
          >
            {minimapOpen ? (
              <span aria-hidden="true">×</span>
            ) : (
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="2" />
                <rect x="14" y="3" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="2" />
                <rect x="3" y="14" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="2" />
                <rect x="14" y="14" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            )}
          </button>
        </Panel>
        {minimapOpen ? (
          <MiniMap
            pannable
            zoomable
            bgColor="rgba(12, 10, 14, 0.92)"
            maskColor="rgba(255, 105, 180, 0.12)"
            maskStrokeColor="#ff69b4"
            maskStrokeWidth={1}
            nodeBorderRadius={2}
            nodeStrokeWidth={1.5}
            nodeStrokeColor={(node) => {
              const data = node.data as ReferralNodeData
              if (data.isYou) return COLORS.l1
              if (data.isRoot) return COLORS.own
              return 'rgba(255, 255, 255, 0.55)'
            }}
            nodeColor={(node) => {
              const data = node.data as ReferralNodeData
              if (data.isYou) return 'rgba(34, 197, 94, 0.85)'
              if (data.isRoot) return 'rgba(255, 105, 180, 0.9)'
              if (data.selected) return 'rgba(201, 162, 39, 0.85)'
              return 'rgba(148, 163, 184, 0.75)'
            }}
          />
        ) : null}
      </ReactFlow>
      )}
    </div>
  )

  if (layout === 'graph-only') {
    return (
      <div className="grai-referral-dash-graph-embed" aria-label="Lockers to claim">
        {error ? (
          <p className="grai-referral-dash-error" role="status">
            {error}
          </p>
        ) : null}
        {graphPanel}
      </div>
    )
  }

  return (
    <section className="grai-referral-dash" aria-label="Referrers dashboard">
      <header className="grai-referral-dash-header">
        <div className="grai-referral-dash-header-copy">
          <h3 className="grai-referral-dash-title">
            <button
              type="button"
              className={`grai-referral-dash-collapse${isDashCollapsed ? ' is-collapsed' : ''}`}
              onClick={() => setIsDashCollapsed((collapsed) => !collapsed)}
              aria-expanded={!isDashCollapsed}
              aria-controls="grai-referral-dash-grid"
              aria-label={isDashCollapsed ? 'Show referrers dashboard' : 'Hide referrers dashboard'}
            >
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
            </button>
            <button
              type="button"
              className="grai-referral-dash-title-action"
              onClick={startMapLoad}
              aria-label="Reload referrers map"
            >
              Referrers dashboard
            </button>
          </h3>
        </div>
      </header>

      {error ? (
        <p className="grai-referral-dash-error" role="status">
          {error}
        </p>
      ) : null}

      <div
        className={`grai-referral-dash-body${isDashCollapsed ? '' : ' is-open'}`}
        id="grai-referral-dash-grid"
        aria-hidden={isDashCollapsed}
      >
        <div className="grai-referral-dash-body-inner">
      <div className="grai-referral-dash-grid">
        {graphPanel}

        <aside className="grai-referral-dash-side">
          <div className="grai-referral-dash-panel">
            {!selected ? (
              <div className="grai-referral-dash-panel-toolbar">
                <h4 className="grai-referral-dash-panel-title">
                  {sideView === 'total' ? 'Total' : 'Top lockers'}
                </h4>
                <div className="grai-referral-dash-view-switch" role="tablist" aria-label="Chart view">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sideView === 'total'}
                    className={`grai-referral-dash-view-btn${sideView === 'total' ? ' is-active' : ''}`}
                    onClick={() => setSideView('total')}
                  >
                    Total
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sideView === 'top'}
                    className={`grai-referral-dash-view-btn${sideView === 'top' ? ' is-active' : ''}`}
                    onClick={() => setSideView('top')}
                  >
                    Top
                  </button>
                </div>
              </div>
            ) : null}
            {!selected ? (
              <p className="grai-referral-dash-panel-sub">
                {sideView === 'total'
                  ? 'Own vs L1 vs L2 book across the visible tree'
                  : 'Ranked by own book, with L1 / L2 stacked'}
              </p>
            ) : null}
            <div
              ref={chartHostRef}
              className="grai-referral-dash-chart"
              onFocusCapture={() => {
                disarmChartFocus()
              }}
            >
              {selected ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={selectedBars}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    barCategoryGap="12%"
                    barGap={8}
                  >
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={42}
                    />
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      formatter={(value) =>
                        `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                      }
                      contentStyle={{
                        background: 'var(--bg-secondary, #141414)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 0,
                        fontSize: 12,
                        color: 'var(--text-primary)',
                      }}
                      labelStyle={{ color: 'var(--text-secondary)' }}
                      itemStyle={{ color: 'var(--text-primary)' }}
                    />
                    <Bar
                      dataKey="value"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={72}
                      isAnimationActive
                      animationDuration={420}
                      animationEasing="ease-in-out"
                    >
                      {selectedBars.map((row) => (
                        <Cell key={row.name} fill={row.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : sideView === 'top' ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topLockers}
                      layout="vertical"
                      margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={108}
                        tick={({ x, y, payload }) => {
                          const row = topLockers.find((item) => item.name === payload.value)
                          const lockerId = row?.id
                          return (
                            <text
                              x={x}
                              y={y}
                              dy={5}
                              textAnchor="end"
                              fill="var(--text-secondary)"
                              fontSize={13}
                              fontWeight={600}
                              style={{ cursor: lockerId ? 'pointer' : 'default' }}
                              onClick={() => {
                                if (lockerId) onTopAxisTickClick(lockerId)
                              }}
                            >
                              {String(payload.value)}
                            </text>
                          )
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'transparent' }}
                        formatter={(value) =>
                          `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                        }
                        contentStyle={{
                          background: 'var(--bg-secondary, #141414)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 0,
                          fontSize: 12,
                          color: 'var(--text-primary)',
                        }}
                        labelStyle={{ color: 'var(--text-secondary)' }}
                        itemStyle={{ color: 'var(--text-primary)' }}
                      />
                      <Bar
                        dataKey="own"
                        stackId="book"
                        fill={COLORS.own}
                        name="Own"
                        cursor="pointer"
                        isAnimationActive={false}
                        onClick={onTopBarClick}
                      />
                      <Bar
                        dataKey="l1"
                        stackId="book"
                        fill={COLORS.l1}
                        name="L1"
                        cursor="pointer"
                        isAnimationActive={false}
                        onClick={onTopBarClick}
                      />
                      <Bar
                        dataKey="l2"
                        stackId="book"
                        fill={COLORS.l2}
                        name="L2"
                        radius={[0, 2, 2, 0]}
                        cursor="pointer"
                        isAnimationActive={false}
                        onClick={onTopBarClick}
                      />
                    </BarChart>
                  </ResponsiveContainer>
              ) : mixPie.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mixPie}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={42}
                      outerRadius={68}
                      paddingAngle={2}
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {mixPie.map((row) => (
                        <Cell key={row.name} fill={row.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) =>
                        `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                      }
                      contentStyle={{
                        background: 'var(--bg-secondary, #141414)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 0,
                        fontSize: 12,
                        color: 'var(--text-primary)',
                      }}
                      labelStyle={{ color: 'var(--text-secondary)' }}
                      itemStyle={{ color: 'var(--text-primary)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : null}
            </div>
            {!selected ? (
              <div className="grai-referral-dash-panel-footer">
                {sideView === 'top' ? (
                  topLockersAll.length > TOP_PAGE_SIZE ? (
                    <div className="grai-referral-dash-pager" aria-label="Top lockers pages">
                      <button
                        type="button"
                        className="grai-referral-dash-pager-btn"
                        disabled={topPage <= 0}
                        aria-label="Previous page"
                        onClick={() => setTopPage((page) => Math.max(0, page - 1))}
                      >
                        ‹
                      </button>
                      <span className="grai-referral-dash-pager-label">{topRangeLabel}</span>
                      <button
                        type="button"
                        className="grai-referral-dash-pager-btn"
                        disabled={topPage >= topPageCount - 1}
                        aria-label="Next page"
                        onClick={() => setTopPage((page) => Math.min(topPageCount - 1, page + 1))}
                      >
                        ›
                      </button>
                    </div>
                  ) : null
                ) : mixPie.length > 0 ? (
                  <ul className="grai-referral-dash-legend">
                    {mixPie.map((row) => (
                      <li key={row.name}>
                        <i style={{ background: row.fill }} aria-hidden="true" />
                        <span>{row.name}</span>
                        <strong>
                          ${row.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </strong>
                      </li>
                    ))}
                    <li className="is-total">
                      <i aria-hidden="true" />
                      <span>Total</span>
                      <strong>
                        $
                        {(
                          toNumber(totals.own, graiDecimals) +
                          toNumber(totals.l1, graiDecimals) +
                          toNumber(totals.l2, graiDecimals)
                        ).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </strong>
                    </li>
                  </ul>
                ) : null}
              </div>
            ) : null}
            {selected ? (
              <div className="grai-referral-dash-poach">
                <div className="grai-action-metrics">
                  <div className="grai-action-metric-row">
                    <span className="grai-action-metric-label">Locker:</span>
                    <span className="grai-action-metric-value" title={selected.locker}>
                      {shortAddress(selected.locker)}
                    </span>
                  </div>
                  <div className="grai-action-metric-row">
                    <span className="grai-action-metric-label">Referrer:</span>
                    <span className="grai-action-metric-value" title={selected.referrer}>
                      {poachSellerLabel}
                    </span>
                  </div>
                  <div className={`grai-action-metric-row${needsGraiDeposit ? ' is-insufficient' : ''}`}>
                    <span className="grai-action-metric-label">Poach price:</span>
                    <span className="grai-action-metric-value is-yield grai-action-metric-value--grai">
                      {formatGraiAmount(poachAsk, graiDecimals)}
                      <img
                        src={assetUrl('logo.png')}
                        alt=""
                        width={18}
                        height={18}
                        loading="lazy"
                        decoding="async"
                      />
                      GRAI
                    </span>
                  </div>
                </div>
                {needsGraiDeposit ? (
                  <p className="grai-referral-dash-poach-warn" role="status">
                    Not enough GRAI in your wallet ({formatGraiAmount(walletGraiRaw, graiDecimals)} /{' '}
                    {formatGraiAmount(poachAsk, graiDecimals)}). Deposit assets to mint GRAI, then
                    poach this seat.
                  </p>
                ) : (
                  <p className="grai-referral-dash-poach-warn is-spacer" aria-hidden="true">
                    &nbsp;
                  </p>
                )}
                {cannotPoachOwnReferral ? (
                  <button
                    type="button"
                    className="grai-mint-btn grai-referral-dash-poach-btn"
                    disabled
                  >
                    You cannot poach your own referrals
                  </button>
                ) : cannotPoachOwnRoot ? (
                  <button
                    type="button"
                    className="grai-mint-btn grai-referral-dash-poach-btn"
                    disabled
                  >
                    You cannot poach your own locker while it has no upline
                  </button>
                ) : !highlightAddress ? (
                  <GraiActionConnectWalletButton />
                ) : needsGraiDeposit ? (
                  <button
                    type="button"
                    className="grai-mint-btn grai-referral-dash-poach-btn"
                    onClick={() => navigateToGraiSection('mint')}
                  >
                    Deposit GRAI
                  </button>
                ) : (
                  <button
                    type="button"
                    className="grai-mint-btn grai-referral-dash-poach-btn"
                    disabled={Boolean(poachBlockedReason) || isPoaching}
                    onClick={() => {
                      void onPoach()
                    }}
                  >
                    {isPoaching ? 'Poaching…' : 'Poach'}
                  </button>
                )}
                <p className="grai-liquidation-buyback-vote-note">
                  You pay GRAI to the locker&apos;s current referrer to become their direct
                  referrer.
                </p>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
        </div>
      </div>
    </section>
  )
}
