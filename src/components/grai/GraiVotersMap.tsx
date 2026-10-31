import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  Background,
  ControlButton,
  Controls,
  Handle,
  MiniMap,
  NodeToolbar,
  Panel,
  Position,
  ReactFlow,
  MarkerType,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { EvmVoterEntry } from '../../grai/evm/readProtocol'
import { formatTokenBalance } from '../../grai/onchain'
import { assetUrl } from '../../utils/appPaths'
import { MINT_ASSET_SOLSCAN_ICON } from './graiPageIcons'

type Props = {
  voters: EvmVoterEntry[]
  graiDecimals: number
  totalVoted: bigint
  totalSupply: bigint
  quorumBps: number
  highlightAddress?: string | null
  explorerAccountUrl?: ((address: string) => string | null) | null
  selectedVoter?: string | null
  onSelectVoter?: (voter: EvmVoterEntry) => void
  /** Bribe form shown under the selected voter (or floating when none). */
  bribePanel?: ReactNode
}

type QuorumNodeData = {
  kind: 'quorum'
  progressPct: number
  votedLabel: string
  requiredLabel: string
  hasQuorum: boolean
}

type VoterNodeData = {
  kind: 'voter'
  address: string
  voteLabel: string
  shareLabel: string
  isYou: boolean
  selected: boolean
  explorerHref: string | null
}

type VotersMapNodeData = QuorumNodeData | VoterNodeData

function shortAddress(address: string): string {
  if (address.length < 10) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function addressKey(address: string): string {
  return address.startsWith('0x') || address.startsWith('0X') ? address.toLowerCase() : address
}

function formatPct(numerator: bigint, denominator: bigint): string {
  if (denominator <= 0n) return '0.0%'
  const pct = Number((numerator * 10_000n) / denominator) / 100
  return `${pct.toFixed(1)}%`
}

function quorumProgressPct(totalVoted: bigint, totalSupply: bigint, quorumBps: number): number {
  if (totalSupply <= 0n || quorumBps <= 0) return 0
  const raw = Number((totalVoted * 1_000_000n) / (totalSupply * BigInt(quorumBps)))
  if (!Number.isFinite(raw)) return 0
  return Math.min(100, Math.max(0, raw))
}

function quorumRequiredAmount(totalSupply: bigint, quorumBps: number): bigint {
  if (totalSupply <= 0n || quorumBps <= 0) return 0n
  return (totalSupply * BigInt(quorumBps)) / 10_000n
}

const QUORUM_ID = 'quorum'
const VOTER_NODE_W = 220
const VOTER_NODE_H = 118
const QUORUM_NODE_W = 240
const QUORUM_NODE_H = 132

function QuorumMapNode({ data }: { data: QuorumNodeData }) {
  return (
    <div className={`grai-voters-map-node is-quorum${data.hasQuorum ? ' is-met' : ''}`}>
      <Handle type="source" position={Position.Top} className="grai-referral-graph-handle" />
      <Handle type="source" position={Position.Right} className="grai-referral-graph-handle" />
      <Handle type="source" position={Position.Bottom} className="grai-referral-graph-handle" />
      <Handle type="source" position={Position.Left} className="grai-referral-graph-handle" />
      <header className="grai-voters-map-node-brand">
        <span className="grai-referral-graph-badge is-root">Quorum</span>
        <span className="grai-voters-map-node-pct">{data.progressPct.toFixed(1)}%</span>
      </header>
      <dl className="grai-referral-graph-node-rows">
        <div>
          <dt>Voted</dt>
          <dd>
            {data.votedLabel}
            <img
              className="grai-voters-map-node-icon"
              src={assetUrl('grai.png')}
              alt=""
              width={12}
              height={12}
              loading="lazy"
              decoding="async"
            />
          </dd>
        </div>
        <div>
          <dt>Need</dt>
          <dd>
            {data.requiredLabel}
            <img
              className="grai-voters-map-node-icon"
              src={assetUrl('grai.png')}
              alt=""
              width={12}
              height={12}
              loading="lazy"
              decoding="async"
            />
          </dd>
        </div>
      </dl>
    </div>
  )
}

function VoterMapNode({ data }: { data: VoterNodeData }) {
  return (
    <div
      className={`grai-voters-map-node is-voter${data.isYou ? ' is-you' : ''}${
        data.selected ? ' is-selected' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} className="grai-referral-graph-handle" />
      <header className="grai-voters-map-node-brand">
        <span className="grai-voters-map-node-share">{data.shareLabel}</span>
        {data.isYou ? <span className="grai-referral-graph-badge is-you">YOU</span> : null}
      </header>
      <dl className="grai-referral-graph-node-rows">
        <div>
          <dt>Voter</dt>
          <dd>
            <span className="grai-voters-map-node-addr" title={data.address}>
              {shortAddress(data.address)}
            </span>
            {data.explorerHref ? (
              <a
                href={data.explorerHref}
                target="_blank"
                rel="noreferrer"
                className="grai-mint-asset-value-solscan"
                aria-label="View voter on block explorer"
                title="View voter on block explorer"
                onClick={(event) => event.stopPropagation()}
              >
                {MINT_ASSET_SOLSCAN_ICON}
              </a>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>Vote</dt>
          <dd>
            {data.voteLabel}
            <img
              className="grai-voters-map-node-icon"
              src={assetUrl('grai.png')}
              alt=""
              width={12}
              height={12}
              loading="lazy"
              decoding="async"
            />
          </dd>
        </div>
      </dl>
    </div>
  )
}

const QuorumMapNodeMemo = memo(QuorumMapNode)
const VoterMapNodeMemo = memo(VoterMapNode)

const nodeTypes: NodeTypes = {
  quorum: QuorumMapNodeMemo as NodeTypes[string],
  voter: VoterMapNodeMemo as NodeTypes[string],
}

function FitViewOnExpand({ expanded }: { expanded: boolean }) {
  const { fitView } = useReactFlow()
  useEffect(() => {
    const id = window.setTimeout(() => {
      void fitView({ padding: 0.22, duration: 220 })
    }, 60)
    return () => window.clearTimeout(id)
  }, [expanded, fitView])
  return null
}

function FitHomeControlButton() {
  const { fitView } = useReactFlow()
  return (
    <ControlButton
      className="react-flow__controls-fitview grai-referral-dash-fit-home grai-voters-map-fit-home"
      onClick={() => {
        void fitView({ padding: 0.22 })
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

function GraphExpandControl({
  expanded,
  onToggle,
}: {
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <Panel position="top-right" className="grai-referral-dash-graph-expand-panel nodrag nopan">
      <button
        type="button"
        className={`grai-referral-dash-graph-expand-btn${expanded ? ' is-expanded' : ''}`}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse map' : 'Expand map'}
        title={expanded ? 'Collapse map' : 'Expand map'}
        onClick={onToggle}
      >
        {expanded ? (
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 3v6H3" />
            <path d="M15 21v-6h6" />
            <path d="M21 9h-6V3" />
            <path d="M3 15h6v6" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 3h6v6" />
            <path d="M9 21H3v-6" />
            <path d="M21 3l-7 7" />
            <path d="M3 21l7-7" />
          </svg>
        )}
      </button>
    </Panel>
  )
}

function buildVotersGraph({
  voters,
  graiDecimals,
  totalVoted,
  totalSupply,
  quorumBps,
  highlightAddress,
  selectedVoter,
  explorerAccountUrl,
}: {
  voters: EvmVoterEntry[]
  graiDecimals: number
  totalVoted: bigint
  totalSupply: bigint
  quorumBps: number
  highlightAddress?: string | null
  selectedVoter?: string | null
  explorerAccountUrl?: ((address: string) => string | null) | null
}): { nodes: Node<VotersMapNodeData>[]; edges: Edge[] } {
  const required = quorumRequiredAmount(totalSupply, quorumBps)
  const progress = quorumProgressPct(totalVoted, totalSupply, quorumBps)
  const highlightKey = highlightAddress ? addressKey(highlightAddress) : null
  const selectedKey = selectedVoter ? addressKey(selectedVoter) : null

  const nodes: Node<VotersMapNodeData>[] = [
    {
      id: QUORUM_ID,
      type: 'quorum',
      position: { x: 0, y: 0 },
      data: {
        kind: 'quorum',
        progressPct: progress,
        votedLabel: formatTokenBalance(totalVoted, graiDecimals),
        requiredLabel: formatTokenBalance(required, graiDecimals),
        hasQuorum: totalVoted >= required && required > 0n,
      },
      draggable: true,
      selectable: false,
    },
  ]

  const edges: Edge[] = []
  const count = voters.length
  const radius = Math.max(280, 140 + count * 28)

  voters.forEach((voter, index) => {
    const id = addressKey(voter.address)
    const angle = count === 1 ? -Math.PI / 2 : (index / count) * Math.PI * 2 - Math.PI / 2
    const x = Math.cos(angle) * radius - VOTER_NODE_W / 2
    const y = Math.sin(angle) * radius - VOTER_NODE_H / 2
    nodes.push({
      id,
      type: 'voter',
      position: { x, y },
      data: {
        kind: 'voter',
        address: voter.address,
        voteLabel: formatTokenBalance(voter.escrowGrai, graiDecimals),
        shareLabel: totalVoted > 0n ? formatPct(voter.escrowGrai, totalVoted) : '0.0%',
        isYou: highlightKey != null && id === highlightKey,
        selected: selectedKey != null && id === selectedKey,
        explorerHref: explorerAccountUrl?.(voter.address) ?? null,
      },
      draggable: true,
      selectable: true,
    })
    edges.push({
      id: `e-${QUORUM_ID}-${id}`,
      source: QUORUM_ID,
      target: id,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
      style: { stroke: 'rgba(148, 163, 184, 0.55)', strokeWidth: 1.5 },
    })
  })

  nodes[0] = {
    ...nodes[0]!,
    position: { x: -QUORUM_NODE_W / 2, y: -QUORUM_NODE_H / 2 },
  }

  return { nodes, edges }
}

export function GraiVotersMap({
  voters,
  graiDecimals,
  totalVoted,
  totalSupply,
  quorumBps,
  highlightAddress,
  explorerAccountUrl,
  selectedVoter,
  onSelectVoter,
  bribePanel = null,
}: Props) {
  const embedRef = useRef<HTMLDivElement | null>(null)
  const [pageHost, setPageHost] = useState<HTMLElement | null>(null)
  const [minimapOpen, setMinimapOpen] = useState(false)
  const [graphExpanded, setGraphExpanded] = useState(false)
  /** Bribe toolbar only after an explicit voter click on the map. */
  const [bribeTargetId, setBribeTargetId] = useState<string | null>(null)
  const selectedKey = bribeTargetId
  const selectedNodeId =
    selectedKey && voters.some((row) => addressKey(row.address) === selectedKey)
      ? selectedKey
      : null

  useEffect(() => {
    if (!bribeTargetId) return
    if (!voters.some((row) => addressKey(row.address) === bribeTargetId)) {
      setBribeTargetId(null)
    }
  }, [bribeTargetId, voters])

  const graph = useMemo(
    () =>
      buildVotersGraph({
        voters,
        graiDecimals,
        totalVoted,
        totalSupply,
        quorumBps,
        highlightAddress,
        selectedVoter: bribeTargetId ?? selectedVoter,
        explorerAccountUrl,
      }),
    [
      bribeTargetId,
      explorerAccountUrl,
      graiDecimals,
      highlightAddress,
      quorumBps,
      selectedVoter,
      totalSupply,
      totalVoted,
      voters,
    ],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges)

  useEffect(() => {
    setNodes(graph.nodes)
    setEdges(graph.edges)
  }, [graph.edges, graph.nodes, setEdges, setNodes])

  useLayoutEffect(() => {
    const host =
      (embedRef.current?.closest('.grai-page') as HTMLElement | null) ??
      (document.querySelector('.grai-page') as HTMLElement | null)
    setPageHost(host)
  }, [])

  useEffect(() => {
    if (!pageHost) return
    pageHost.classList.toggle('is-voters-map-expanded', graphExpanded)
    return () => {
      pageHost.classList.remove('is-voters-map-expanded')
    }
  }, [graphExpanded, pageHost])

  useLayoutEffect(() => {
    if (!graphExpanded || !pageHost) return
    const embed = embedRef.current
    if (!embed) return

    const clearInline = () => {
      embed.style.top = ''
      embed.style.left = ''
      embed.style.width = ''
      embed.style.height = ''
    }

    const applyViewportBounds = () => {
      const rect = pageHost.getBoundingClientRect()
      const header = document.querySelector('header.header')
      const headerBottom = header ? Math.ceil(header.getBoundingClientRect().bottom) : 0
      const top = headerBottom
      const left = Math.max(0, Math.floor(rect.left))
      const right = Math.min(window.innerWidth, Math.ceil(rect.right))
      const bottom = window.innerHeight
      const width = Math.max(0, right - left)
      embed.style.top = `${top}px`
      embed.style.left = `${left}px`
      embed.style.width = `${width}px`
      embed.style.height = `${Math.max(0, bottom - top)}px`
      embed.style.setProperty('--grai-claim-map-width', `${Math.round(width)}px`)
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    applyViewportBounds()
    window.addEventListener('resize', applyViewportBounds)
    window.addEventListener('scroll', applyViewportBounds, true)
    return () => {
      window.removeEventListener('resize', applyViewportBounds)
      window.removeEventListener('scroll', applyViewportBounds, true)
      document.body.style.overflow = prevOverflow
      clearInline()
    }
  }, [graphExpanded, pageHost])

  useEffect(() => {
    if (!graphExpanded) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGraphExpanded(false)
    }
    const onPointerDown = (event: PointerEvent) => {
      const embed = embedRef.current
      const target = event.target
      if (!(target instanceof globalThis.Node)) return
      if (embed && embed.contains(target)) return
      setGraphExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [graphExpanded])

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      if (node.type !== 'voter') return
      const voter = voters.find((row) => addressKey(row.address) === node.id)
      if (!voter) return
      setBribeTargetId(node.id)
      onSelectVoter?.(voter)
    },
    [onSelectVoter, voters],
  )

  const graphPanel = (
    <div className="grai-referral-dash-graph grai-voters-map-graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.22 }}
        minZoom={0.25}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
      >
        <Background gap={22} size={1} color="rgba(148, 163, 184, 0.18)" />
        <Controls showInteractive={false} showFitView={false}>
          <FitHomeControlButton />
        </Controls>
        <FitViewOnExpand expanded={graphExpanded} />
        <GraphExpandControl
          expanded={graphExpanded}
          onToggle={() => setGraphExpanded((open) => !open)}
        />
        <Panel position="top-left" className="grai-voters-map-title-panel nodrag nopan">
          <h3 className="grai-voters-map-title">Voters Map</h3>
          <p className="grai-voters-map-sub">
            {voters.length === 0
              ? 'No active voters yet.'
              : `${voters.length} voter${voters.length === 1 ? '' : 's'} · ${formatPct(
                  totalVoted,
                  totalSupply > 0n ? totalSupply : 1n,
                )} of supply`}
          </p>
        </Panel>
        {bribePanel && selectedNodeId ? (
          <NodeToolbar
            nodeId={selectedNodeId}
            isVisible
            position={Position.Bottom}
            offset={14}
            align="center"
            className="grai-referral-dash-claim-toolbar grai-voters-map-bribe-toolbar nodrag nopan"
          >
            <div className="grai-referral-dash-claim-toolbar-inner">{bribePanel}</div>
          </NodeToolbar>
        ) : null}
        <Panel position="bottom-right" className="grai-referral-dash-minimap-panel nodrag nopan">
          <button
            type="button"
            className={`grai-referral-dash-minimap-toggle${minimapOpen ? ' is-open' : ''}`}
            aria-pressed={minimapOpen}
            aria-label={minimapOpen ? 'Hide minimap' : 'Show minimap'}
            title="Minimap"
            onClick={() => setMinimapOpen((openMap) => !openMap)}
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
          {minimapOpen ? (
            <MiniMap
              pannable
              zoomable
              nodeStrokeWidth={2}
              maskColor="rgba(10, 10, 10, 0.55)"
              nodeColor={(node) => {
                if (node.type === 'quorum') return 'rgba(255, 45, 140, 0.85)'
                if ((node.data as VoterNodeData | undefined)?.isYou) return 'rgba(34, 197, 94, 0.85)'
                if ((node.data as VoterNodeData | undefined)?.selected) {
                  return 'rgba(201, 162, 39, 0.85)'
                }
                return 'rgba(148, 163, 184, 0.75)'
              }}
            />
          ) : null}
        </Panel>
      </ReactFlow>
    </div>
  )

  const graphEmbed = (
    <div
      ref={embedRef}
      className={`grai-referral-dash-graph-embed grai-voters-map-embed${
        graphExpanded ? ' is-expanded' : ''
      }`}
      aria-label="Voters map"
    >
      {graphPanel}
    </div>
  )

  if (graphExpanded && pageHost) {
    return (
      <>
        <div className="grai-referral-dash-graph-embed grai-voters-map-embed is-slot" aria-hidden="true" />
        {createPortal(graphEmbed, pageHost)}
      </>
    )
  }

  return graphEmbed
}
