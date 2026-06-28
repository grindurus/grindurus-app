import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
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

type FlowVariant = 'user' | 'grai' | 'senior' | 'junior' | 'custody' | 'treasury'

type GraiFlowNodeData = {
  label: string
  variant: FlowVariant
}

type FlowDiagramConfig = {
  id: string
  title: string
  description: string
  height: number
  fitPadding?: number
  centerInPane?: boolean
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
) {
  const bounds = getNodesBounds(instance.getNodes())
  const x = (container.clientWidth - bounds.width * zoom) / 2 - bounds.x * zoom
  const y = (container.clientHeight - bounds.height * zoom) / 2 - bounds.y * zoom
  instance.setViewport({ x, y, zoom })
}

const FLOW_DIAGRAMS: FlowDiagramConfig[] = [
  {
    id: 'mint',
    title: 'Mint',
    description:
      'User deposits assets into GRAI. The protocol splits capital across senior and junior vaults, then mints GRAI to the user at current NAV.',
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
    description: 'Protocol authority moves capital from the junior vault into grinder custody wallets.',
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
    id: 'distribute',
    title: 'Distribute',
    description:
      'Custody wallet sends earned yield back on-chain. Most replenishes the senior vault (NAV); the remainder goes to treasury.',
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
      'User burns GRAI. The senior vault returns idle collateral back to the user in proportion to the burn.',
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
  labelNearSource?: boolean
  /** 0 = at source, 1 = on-path label anchor from React Flow */
  labelAlong?: number
  labelAbove?: boolean
  labelBelow?: boolean
  labelAtFork?: boolean
  labelOffsetX?: number
  labelOffsetY?: number
  labelProminent?: boolean
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
  const [edgePath, labelX, labelY] = edgeData?.straight
    ? getStraightPath({ sourceX, sourceY, targetX, targetY })
    : getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 10,
      })
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
      displayY -= 14
    }
    if (edgeData?.labelBelow) {
      displayY += 14
    }
  }

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className={`nodrag nopan grai-flow-edge-label${edgeData?.labelProminent ? ' is-prominent' : ''}`}
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
}

function FlowCanvas({
  nodes,
  edges,
  height,
  fitPadding = FLOW_FIT_PADDING,
  centerInPane = false,
}: FlowCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)
  const flowNodes = useMemo(() => nodes, [nodes])
  const flowEdges = useMemo(() => edges, [edges])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const onInit = useCallback((instance: ReactFlowInstance<Node<GraiFlowNodeData>, Edge>) => {
    cancelAnimationFrame(rafRef.current)
    const zoom = FLOW_FIXED_ZOOM
    const center = () => {
      if (centerInPane && containerRef.current) {
        centerFlowInPane(instance, containerRef.current, zoom)
        return
      }
      void instance.fitView({
        padding: fitPadding,
        minZoom: zoom,
        maxZoom: zoom,
        duration: 0,
      })
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(center)
    })
  }, [fitPadding, centerInPane])

  return (
    <div ref={containerRef} className="grai-token-flow-canvas" style={{ height }}>
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

export function GraiTokenFlowDiagram() {
  return (
    <div className="grai-token-flow" role="region" aria-label="GRAI token flow">
      {FLOW_DIAGRAMS.map((diagram, index) => (
        <article className="grai-token-flow-step" key={diagram.id}>
          <div className="grai-token-flow-step-head">
            <span className="grai-token-flow-step-title">
              {index + 1}. {diagram.title}
            </span>
            <p className="grai-token-flow-step-desc">{diagram.description}</p>
          </div>
          <FlowCanvas
            nodes={diagram.nodes}
            edges={diagram.edges}
            height={diagram.height}
            fitPadding={diagram.fitPadding}
            centerInPane={diagram.centerInPane}
          />
        </article>
      ))}
    </div>
  )
}
