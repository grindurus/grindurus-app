import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  getNodesBounds,
  getSmoothStepPath,
  getStraightPath,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type Node,
  type NodeTypes,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './GraiTokenFlowDiagram.css'

type FlowVariant = 'user' | 'grai' | 'senior' | 'junior' | 'custody' | 'treasury' | 'aggregator'

type GraiFlowNodeData = {
  label: string
  variant: FlowVariant
}

type FlowDiagramConfig = {
  id: string
  title: string
  description: string | string[]
  height: number
  fitPadding?: number
  centerInPane?: boolean
  paneOffsetY?: number
  fullWidth?: boolean
  nodes: Node<GraiFlowNodeData>[]
  edges: Edge[]
}

const edgeDefaults = {
  type: 'graiFlow' as const,
  markerEnd: { type: MarkerType.ArrowClosed, color: '#ff69b4', width: 20, height: 20 },
  style: { stroke: '#ff69b4', strokeWidth: 2.4, opacity: 0.95 },
  zIndex: 2,
}

const FLOW_CANVAS_HEIGHT = 150
const FLOW_FIT_PADDING = 0.34
const FLOW_FIXED_ZOOM = 1.14
const FLOW_NODE_W = 86
const FLOW_NODE_H = 32
const BURN_GAP_X = 72
const BURN_GAP_Y = 20
const BURN_RIGHT_X = FLOW_NODE_W + BURN_GAP_X
const BURN_USER_Y = FLOW_NODE_H / 2 + BURN_GAP_Y / 2
const BURN_SENIOR_Y = FLOW_NODE_H + BURN_GAP_Y

function centerFlowInPane(
  instance: ReactFlowInstance<Node<GraiFlowNodeData>, Edge>,
  container: HTMLDivElement,
  zoom: number,
  offsetY = 0,
) {
  const bounds = getNodesBounds(instance.getNodes())
  const x = (container.clientWidth - bounds.width * zoom) / 2 - bounds.x * zoom
  const y = (container.clientHeight - bounds.height * zoom) / 2 - bounds.y * zoom + offsetY
  instance.setViewport({ x, y, zoom })
}

const FLOW_DIAGRAMS: FlowDiagramConfig[] = [
  {
    id: 'mint',
    title: 'Mint',
    description: [
      'Deposit assets to mint GRAI.',
      'Part of your capital becomes collateral backing GRAI.',
      'The other part is allocated to autonomous grinder strategies to generate yield.',
    ],
    height: FLOW_CANVAS_HEIGHT,
    nodes: [
      { id: 'user', type: 'graiFlow', position: { x: 0, y: 50 }, data: { label: 'User', variant: 'user' } },
      { id: 'grai', type: 'graiFlow', position: { x: 122, y: 50 }, data: { label: 'GRAI', variant: 'grai' } },
      { id: 'senior', type: 'graiFlow', position: { x: 262, y: 8 }, data: { label: 'Senior Vault', variant: 'senior' } },
      { id: 'junior', type: 'graiFlow', position: { x: 262, y: 92 }, data: { label: 'Junior Vault', variant: 'junior' } },
    ],
    edges: [
      {
        id: 'mint-deposit',
        source: 'user',
        target: 'grai',
        sourceHandle: 'bottom-out',
        targetHandle: 'bottom-in',
        label: '1. deposit',
        data: { labelAlong: 0.5 },
        ...edgeDefaults,
      },
      {
        id: 'mint-split-senior',
        source: 'grai',
        target: 'senior',
        sourceHandle: 'right-top',
        targetHandle: 'left',
        label: '2. split',
        data: { labelAtFork: true, labelOffsetX: 18, labelOffsetY: -8 },
        ...edgeDefaults,
      },
      {
        id: 'mint-split-junior',
        source: 'grai',
        target: 'junior',
        sourceHandle: 'right-bottom',
        targetHandle: 'left',
        ...edgeDefaults,
      },
      {
        id: 'mint-to-user',
        source: 'grai',
        target: 'user',
        sourceHandle: 'top-out',
        targetHandle: 'top',
        label: '3. mint',
        data: { labelAlong: 0.52 },
        ...edgeDefaults,
      },
    ],
  },
  {
    id: 'allocate',
    title: 'Allocate',
    description:
      'The protocol allocates from Junior Vault to independent grinder custodies.',
    height: FLOW_CANVAS_HEIGHT,
    nodes: [
      { id: 'junior', type: 'graiFlow', position: { x: 0, y: 34 }, data: { label: 'Junior Vault', variant: 'junior' } },
      { id: 'custody', type: 'graiFlow', position: { x: 210, y: 34 }, data: { label: 'Grinder Custody X', variant: 'custody' } },
    ],
    edges: [
      {
        id: 'allocate',
        source: 'junior',
        target: 'custody',
        sourceHandle: 'right',
        targetHandle: 'left',
        label: 'allocate',
        data: { straight: true, labelAlong: 0.5, labelAbove: true },
        ...edgeDefaults,
      },
    ],
  },
  {
    id: 'decision',
    title: 'Strategy',
    description:
      'Each grinder independently decides whether to buy, sell or hold assets with aim to make yield on market price volatility.',
    height: 190,
    fitPadding: 0.28,
    centerInPane: true,
    paneOffsetY: 14,
    nodes: [
      { id: 'custody', type: 'graiFlow', position: { x: 100, y: 58 }, data: { label: 'Grinder Custody X', variant: 'custody' } },
    ],
    edges: [
      {
        id: 'make-decision',
        source: 'custody',
        target: 'custody',
        sourceHandle: 'left-out',
        targetHandle: 'right-in',
        label: 'make decision',
        data: { selfLoop: true, loopSide: 'top', loopOffset: 34, labelAbove: true, labelOffsetY: 4, labelNowrap: true },
        ...edgeDefaults,
      },
    ],
  },
  {
    id: 'swap',
    title: 'Swap',
    description:
      'Grinder Custody X submits a swap intent to Swap Aggregator; executed swaps are settled back into custody.',
    height: 190,
    fitPadding: 0.24,
    centerInPane: true,
    nodes: [
      { id: 'custody', type: 'graiFlow', position: { x: 0, y: 58 }, data: { label: 'Grinder Custody X', variant: 'custody' } },
      {
        id: 'aggregator',
        type: 'graiFlow',
        position: { x: 230, y: 58 },
        data: { label: 'Swap Aggregator', variant: 'aggregator' },
      },
    ],
    edges: [
      {
        id: 'swap-intent',
        source: 'custody',
        target: 'aggregator',
        sourceHandle: 'top-out',
        targetHandle: 'top',
        label: '1. swap intent',
        data: { labelAlong: 0.5, labelBelow: true, labelOffsetY: -18, stepOffset: 34, labelNowrap: true },
        ...edgeDefaults,
      },
      {
        id: 'swap-execution',
        source: 'aggregator',
        target: 'custody',
        sourceHandle: 'bottom-out',
        targetHandle: 'bottom-in',
        label: '2. swap execution',
        data: { labelAlong: 0.5, labelAbove: true, labelOffsetY: 18, stepOffset: 34, labelNowrap: true },
        ...edgeDefaults,
      },
    ],
  },
  {
    id: 'distribute',
    title: 'Distribute',
    description: [
      'Generated yield is sent back to the Senior Vault.',
      'Treasury receives only protocol fees.',
    ],
    height: FLOW_CANVAS_HEIGHT,
    nodes: [
      { id: 'custody', type: 'graiFlow', position: { x: 0, y: 30 }, data: { label: 'Grinder Custody X', variant: 'custody' } },
      { id: 'senior', type: 'graiFlow', position: { x: 228, y: 4 }, data: { label: 'Senior Vault', variant: 'senior' } },
      { id: 'treasury', type: 'graiFlow', position: { x: 228, y: 64 }, data: { label: 'Treasury', variant: 'treasury' } },
    ],
    edges: [
      {
        id: 'distribute-senior',
        source: 'custody',
        target: 'senior',
        sourceHandle: 'right-top',
        targetHandle: 'left',
        label: 'YIELD',
        data: { straight: true, labelAlong: 0.5, labelAbove: true },
        ...edgeDefaults,
      },
      {
        id: 'distribute-treasury',
        source: 'custody',
        target: 'treasury',
        sourceHandle: 'right-bottom',
        targetHandle: 'left',
        label: 'FEE',
        data: { straight: true, labelAlong: 0.5, labelBelow: true },
        ...edgeDefaults,
      },
    ],
  },
  {
    id: 'burn',
    title: 'Burn',
    description:
      'User burns GRAI. The senior vault returns collateral to the user in proportion to the burn.',
    height: FLOW_CANVAS_HEIGHT,
    centerInPane: true,
    nodes: [
      { id: 'user', type: 'graiFlow', position: { x: 0, y: BURN_USER_Y }, width: FLOW_NODE_W, height: FLOW_NODE_H, data: { label: 'User', variant: 'user' } },
      { id: 'grai', type: 'graiFlow', position: { x: BURN_RIGHT_X, y: 0 }, width: FLOW_NODE_W, height: FLOW_NODE_H, data: { label: 'GRAI', variant: 'grai' } },
      {
        id: 'senior',
        type: 'graiFlow',
        position: { x: BURN_RIGHT_X, y: BURN_SENIOR_Y },
        width: FLOW_NODE_W,
        height: FLOW_NODE_H,
        data: { label: 'Senior Vault', variant: 'senior' },
      },
    ],
    edges: [
      {
        id: 'burn-grai',
        source: 'user',
        target: 'grai',
        sourceHandle: 'right-top',
        targetHandle: 'left',
        label: 'burn',
        data: { straight: true, labelAlong: 0.5, labelAbove: true },
        ...edgeDefaults,
      },
      {
        id: 'burn-redeem',
        source: 'senior',
        target: 'user',
        sourceHandle: 'left-out',
        targetHandle: 'right-bottom',
        label: 'redeem',
        data: { straight: true, labelAlong: 0.5, labelAbove: true },
        ...edgeDefaults,
      },
    ],
  },
]

const GraiFlowNode = memo(function GraiFlowNode({ data }: { data: GraiFlowNodeData }) {
  return (
    <div className={`grai-flow-node grai-flow-node--${data.variant}`}>
      <Handle className="grai-flow-handle" type="target" position={Position.Left} id="left" />
      <Handle className="grai-flow-handle" type="target" position={Position.Top} id="top" />
      <Handle className="grai-flow-handle" type="target" position={Position.Right} id="right-in" />
      <Handle className="grai-flow-handle" type="target" position={Position.Right} id="right-bottom" style={{ top: '72%' }} />
      <Handle className="grai-flow-handle" type="target" position={Position.Bottom} id="bottom-in" />
      <span className="grai-flow-node-label">{data.label}</span>
      <Handle className="grai-flow-handle" type="source" position={Position.Top} id="top-out" />
      <Handle className="grai-flow-handle" type="source" position={Position.Left} id="left-out" />
      <Handle className="grai-flow-handle" type="source" position={Position.Right} id="right-top" style={{ top: '28%' }} />
      <Handle className="grai-flow-handle" type="source" position={Position.Right} id="right-bottom" style={{ top: '72%' }} />
      <Handle className="grai-flow-handle" type="source" position={Position.Right} id="right" />
      <Handle className="grai-flow-handle" type="source" position={Position.Bottom} id="bottom-out" />
    </div>
  )
})

type GraiFlowEdgeData = {
  straight?: boolean
  selfLoop?: boolean
  loopOffset?: number
  loopSide?: 'top' | 'bottom' | 'right'
  stepOffset?: number
  labelNearSource?: boolean
  /** 0 = at source, 1 = on-path label anchor from React Flow */
  labelAlong?: number
  labelAbove?: boolean
  labelBelow?: boolean
  labelAtFork?: boolean
  labelOffsetX?: number
  labelOffsetY?: number
  labelProminent?: boolean
  labelNowrap?: boolean
}

function GraiFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const edgeData = data as GraiFlowEdgeData | undefined
  let edgePath: string
  let labelX: number
  let labelY: number

  if (edgeData?.selfLoop) {
    const loopOffset = edgeData.loopOffset ?? 48
    const loopSide = edgeData.loopSide ?? 'right'

    if (loopSide === 'top') {
      const arcY = Math.min(sourceY, targetY) - loopOffset
      const outwardLeft = sourceX - loopOffset * 0.5
      const outwardRight = targetX + loopOffset * 0.5
      edgePath = `M ${sourceX},${sourceY} L ${outwardLeft},${sourceY} L ${outwardLeft},${arcY} L ${outwardRight},${arcY} L ${outwardRight},${targetY} L ${targetX},${targetY}`
      labelX = (outwardLeft + outwardRight) / 2
      labelY = arcY
    } else if (loopSide === 'bottom') {
      const arcY = Math.max(sourceY, targetY) + loopOffset
      const outwardLeft = sourceX - loopOffset * 0.5
      const outwardRight = targetX + loopOffset * 0.5
      edgePath = `M ${sourceX},${sourceY} L ${outwardLeft},${sourceY} L ${outwardLeft},${arcY} L ${outwardRight},${arcY} L ${outwardRight},${targetY} L ${targetX},${targetY}`
      labelX = (outwardLeft + outwardRight) / 2
      labelY = arcY
    } else {
      const rightX = Math.max(sourceX, targetX) + loopOffset
      edgePath = `M ${sourceX},${sourceY} L ${rightX},${sourceY} L ${rightX},${targetY} L ${targetX},${targetY}`
      labelX = rightX
      labelY = (sourceY + targetY) / 2
    }
  } else {
    ;[edgePath, labelX, labelY] = edgeData?.straight
      ? getStraightPath({ sourceX, sourceY, targetX, targetY })
      : getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          borderRadius: 12,
          offset: edgeData?.stepOffset,
        })
  }
  let displayX: number
  let displayY: number

  if (edgeData?.labelAtFork) {
    const forkOffset = Math.min(44, Math.max(28, (labelX - sourceX) * 0.42))
    displayX = sourceX + forkOffset + (edgeData.labelOffsetX ?? 0)
    displayY = sourceY + 12 + (edgeData.labelOffsetY ?? 0)
  } else {
    const along = edgeData?.labelAlong ?? (edgeData?.labelNearSource ? 0.22 : 1)
    displayX = sourceX + (labelX - sourceX) * along
    displayY = sourceY + (labelY - sourceY) * along
    if (edgeData?.labelAbove) {
      displayY -= 22
    }
    if (edgeData?.labelBelow) {
      displayY += 22
    }
    displayX += edgeData?.labelOffsetX ?? 0
    displayY += edgeData?.labelOffsetY ?? 0
  }

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className={`nodrag nopan grai-flow-edge-label${edgeData?.labelProminent ? ' is-prominent' : ''}${edgeData?.labelNowrap ? ' is-nowrap' : ''}`}
            style={{
              transform: `translate(-50%, -50%) translate(${displayX}px, ${displayY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

const nodeTypes: NodeTypes = { graiFlow: GraiFlowNode }
const edgeTypes: EdgeTypes = { graiFlow: GraiFlowEdge }

type FlowCanvasProps = {
  nodes: Node<GraiFlowNodeData>[]
  edges: Edge[]
  height: number
  fitPadding?: number
  centerInPane?: boolean
  paneOffsetY?: number
}

function FlowCanvas({
  nodes,
  edges,
  height,
  fitPadding = FLOW_FIT_PADDING,
  centerInPane = false,
  paneOffsetY = 0,
}: FlowCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<ReactFlowInstance<Node<GraiFlowNodeData>, Edge> | null>(null)
  const rafRef = useRef(0)
  const [isReady, setIsReady] = useState(false)
  const flowNodes = useMemo(() => nodes, [nodes])
  const flowEdges = useMemo(() => edges, [edges])

  const applyViewport = useCallback(() => {
    const instance = instanceRef.current
    const container = containerRef.current
    if (!instance || !container) return

    const padding = container.clientWidth < 520 ? 0.16 : fitPadding

    instance.fitView({
      padding,
      maxZoom: FLOW_FIXED_ZOOM,
      duration: 0,
    })

    if (centerInPane) {
      requestAnimationFrame(() => {
        const { zoom } = instance.getViewport()
        centerFlowInPane(instance, container, zoom, paneOffsetY)
      })
    }
  }, [centerInPane, fitPadding, paneOffsetY])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        applyViewport()
      })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [applyViewport])

  const onInit = useCallback((instance: ReactFlowInstance<Node<GraiFlowNodeData>, Edge>) => {
    instanceRef.current = instance
    cancelAnimationFrame(rafRef.current)
    setIsReady(false)
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        applyViewport()
        setIsReady(true)
      })
    })
  }, [applyViewport])

  return (
    <div
      ref={containerRef}
      className={`grai-token-flow-canvas${isReady ? ' is-ready' : ''}`}
      style={{ height }}
    >
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={onInit}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        tabIndex={-1}
      >
        <Background gap={18} size={1} color="rgba(148, 163, 184, 0.14)" />
      </ReactFlow>
    </div>
  )
}

export function GraiTokenFlowDiagram({
  stepIds,
  className,
}: {
  stepIds?: string[]
  className?: string
} = {}) {
  const diagrams = useMemo(() => {
    if (!stepIds?.length) return FLOW_DIAGRAMS
    const selected = new Set(stepIds)
    return FLOW_DIAGRAMS.filter((diagram) => selected.has(diagram.id)).sort(
      (a, b) => stepIds.indexOf(a.id) - stepIds.indexOf(b.id),
    )
  }, [stepIds])

  return (
    <div
      className={['grai-token-flow', className].filter(Boolean).join(' ')}
      role="region"
      aria-label="GRAI token flow"
    >
      {diagrams.map((diagram, index) => {
        const stepNumber = stepIds?.length
          ? FLOW_DIAGRAMS.findIndex((item) => item.id === diagram.id) + 1
          : index + 1
        return (
          <article
            className={`grai-token-flow-step${diagram.fullWidth ? ' grai-token-flow-step--full' : ''}`}
            key={diagram.id}
          >
            <div className="grai-token-flow-step-head">
              <span className="grai-token-flow-step-title">
                {stepNumber}. {diagram.title}
              </span>
              <p className="grai-token-flow-step-desc">
                {(Array.isArray(diagram.description) ? diagram.description : [diagram.description]).map(
                  (paragraph, paragraphIndex) => (
                    <span className="grai-token-flow-step-desc-line" key={paragraphIndex}>
                      {paragraph}
                    </span>
                  ),
                )}
              </p>
            </div>
            <FlowCanvas
              nodes={diagram.nodes}
              edges={diagram.edges}
              height={diagram.height}
              fitPadding={diagram.fitPadding}
              centerInPane={diagram.centerInPane}
              paneOffsetY={diagram.paneOffsetY}
            />
          </article>
        )
      })}
    </div>
  )
}
