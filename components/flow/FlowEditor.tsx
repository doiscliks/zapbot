'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Connection, type Node, type Edge, type NodeTypes,
  useReactFlow, ReactFlowProvider, Panel,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useRouter } from 'next/navigation'
import { Save, Play, Power, ArrowLeft, Loader2, CheckCircle, AlertCircle, Trash2, ShieldCheck, X } from 'lucide-react'
import FlowNode from './FlowNode'
import ConditionNode from './ConditionNode'
import BlockPanel from './BlockPanel'
import ConfigPanel from './ConfigPanel'
import FlowSettingsPanel from './FlowSettingsPanel'
import { NODE_CONFIG, NodeType, CONDITION_TYPES } from './nodeConfig'

const nodeTypes: NodeTypes = { flowNode: FlowNode, condition: ConditionNode }

const defaultEdgeOptions = {
  animated: true,
  style: { stroke: '#8b5cf6', strokeWidth: 2 },
}

interface FlowMeta {
  name: string
  description: string
  status: string
  flow_type: string
  trigger_type: string
  trigger_config: Record<string, unknown>
  whatsapp_instance_id: string
  schedule_config: Record<string, unknown>
  contact_filters: Record<string, unknown>
}

interface Instancia {
  id: string
  nome: string
  telefone: string | null
}

function validateFlow(nodes: Node[], edges: Edge[]): string[] {
  const errors: string[] = []

  const startNodes = nodes.filter(n => (n.data as Record<string, unknown>).nodeType === 'start')
  if (startNodes.length === 0) errors.push('Adicione um bloco de Início ao fluxo')
  if (startNodes.length > 1) errors.push('O fluxo deve ter apenas um bloco de Início')

  const connectedSources = new Set(edges.map(e => e.source))
  const noOutgoing = nodes.filter(n => {
    const d = n.data as Record<string, unknown>
    return d.nodeType !== 'end' && d.nodeType !== 'human_transfer' && !connectedSources.has(n.id)
  })
  if (noOutgoing.length > 0) {
    errors.push(`${noOutgoing.length} bloco(s) sem saída: ${noOutgoing.map(n => `"${(n.data as Record<string, unknown>).label}"`).join(', ')}`)
  }

  const connectedTargets = new Set(edges.map(e => e.target))
  const noIncoming = nodes.filter(n => {
    const d = n.data as Record<string, unknown>
    return d.nodeType !== 'start' && !connectedTargets.has(n.id)
  })
  if (noIncoming.length > 0) {
    errors.push(`${noIncoming.length} bloco(s) sem entrada: ${noIncoming.map(n => `"${(n.data as Record<string, unknown>).label}"`).join(', ')}`)
  }

  for (const node of nodes) {
    const d = node.data as Record<string, unknown>
    if (d.nodeType === 'message' && !(d.text as string)?.trim())
      errors.push(`"${d.label}": texto da mensagem vazio`)
    if (['send_image', 'send_audio', 'send_video', 'send_document'].includes(d.nodeType as string) && !(d.media_url as string)?.trim())
      errors.push(`"${d.label}": URL da mídia não configurada`)
    if (d.nodeType === 'webhook' && !(d.url as string)?.trim())
      errors.push(`"${d.label}": URL do webhook vazia`)
    if (d.nodeType === 'question' && !(d.text as string)?.trim())
      errors.push(`"${d.label}": texto da pergunta vazio`)
    if (d.nodeType === 'check_keyword' && !(d.keywords as string)?.trim())
      errors.push(`"${d.label}": nenhuma palavra-chave configurada`)
    if (d.nodeType === 'add_tag' && !(d.tag as string)?.trim())
      errors.push(`"${d.label}": tag não configurada`)
    if (d.nodeType === 'remove_tag' && !(d.tag as string)?.trim())
      errors.push(`"${d.label}": tag não configurada`)
  }

  return errors
}

function Editor({ flowId }: { flowId: string }) {
  const router = useRouter()
  const reactFlow = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [flowMeta, setFlowMeta] = useState<FlowMeta>({
    name: 'Novo Fluxo',
    description: '',
    status: 'rascunho',
    flow_type: 'chatbot',
    trigger_type: 'nova_mensagem',
    trigger_config: {},
    whatsapp_instance_id: '',
    schedule_config: {},
    contact_filters: {},
  })
  const [instancias, setInstancias] = useState<Instancia[]>([])
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [testPhone, setTestPhone] = useState('')
  const [showTestModal, setShowTestModal] = useState(false)
  const [showValidation, setShowValidation] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const dragType = useRef<NodeType | null>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDirty = useRef(false)
  const isLoadingRef = useRef(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/fluxos/${flowId}`).then(r => r.json()),
      fetch('/api/instancias').then(r => r.ok ? r.json() : []),
    ]).then(([data, insts]) => {
      if (!data.error) {
        setFlowMeta({
          name: data.name,
          description: data.description ?? '',
          status: data.status,
          flow_type: data.flow_type ?? 'chatbot',
          trigger_type: data.trigger_type,
          trigger_config: data.trigger_config ?? {},
          whatsapp_instance_id: data.whatsapp_instance_id ?? '',
          schedule_config: data.schedule_config ?? {},
          contact_filters: data.contact_filters ?? {},
        })
        setNodes((data.nodes ?? []).map((n: Record<string, unknown>) => ({
          id: n.id as string,
          type: CONDITION_TYPES.has(n.type as string) ? 'condition' : 'flowNode',
          position: { x: n.position_x as number, y: n.position_y as number },
          data: n.data as Record<string, unknown>,
        })))
        setEdges((data.edges ?? []).map((e: Record<string, unknown>) => ({
          id: e.id as string,
          source: e.source_node_id as string,
          target: e.target_node_id as string,
          sourceHandle: (e.source_handle as string) || undefined,
          targetHandle: (e.target_handle as string) || undefined,
          label: (e.condition_label as string) || undefined,
          animated: true,
          style: { stroke: '#8b5cf6', strokeWidth: 2 },
        })))
        setTimeout(() => reactFlow.fitView({ padding: 0.2 }), 100)
      }
      setInstancias(Array.isArray(insts) ? insts : [])
    }).finally(() => {
      setLoading(false)
      isLoadingRef.current = false
    })
  }, [flowId])

  // Auto-save: 30s after last change
  useEffect(() => {
    if (isLoadingRef.current) return
    isDirty.current = true
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      if (isDirty.current) {
        salvar(true)
        isDirty.current = false
      }
    }, 30000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, flowMeta])

  useEffect(() => () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
  }, [])

  const onConnect = useCallback((connection: Connection) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setEdges((prev: Edge[]) => addEdge({ ...connection, animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 } } as any, prev) as Edge[])
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const type = dragType.current
    if (!type) return
    const position = reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const cfg = NODE_CONFIG[type]
    const newNode: Node = {
      id: crypto.randomUUID(),
      type: CONDITION_TYPES.has(type) ? 'condition' : 'flowNode',
      position,
      data: { ...cfg.defaultData },
    }
    setNodes(prev => [...prev, newNode])
    dragType.current = null
  }, [reactFlow])

  const handleDragStart = useCallback((e: React.DragEvent, type: NodeType) => {
    dragType.current = type
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null

  const updateNodeData = useCallback((key: string, value: unknown) => {
    setNodes(prev => prev.map(n =>
      n.id === selectedNodeId ? { ...n, data: { ...n.data, [key]: value } } : n
    ))
  }, [selectedNodeId])

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return
    setNodes(prev => prev.filter(n => n.id !== selectedNodeId))
    setEdges(prev => prev.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId))
    setSelectedNodeId(null)
  }, [selectedNodeId])

  const updateFlowMeta = useCallback((key: string, value: unknown) => {
    setFlowMeta(prev => ({ ...prev, [key]: value }))
  }, [])

  async function salvar(silent = false) {
    if (!silent) setSaving(true)
    setSaveStatus('idle')
    try {
      const res = await fetch(`/api/fluxos/${flowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...flowMeta,
          nodes: nodes.map(n => ({
            id: n.id,
            type: (n.data as Record<string, unknown>).nodeType as string,
            position_x: n.position.x,
            position_y: n.position.y,
            data: n.data,
          })),
          edges: edges.map(e => ({
            id: e.id,
            source_node_id: e.source,
            target_node_id: e.target,
            source_handle: e.sourceHandle ?? null,
            target_handle: e.targetHandle ?? null,
            condition_label: (e.label as string) ?? null,
          })),
        }),
      })
      if (!silent) {
        setSaveStatus(res.ok ? 'ok' : 'error')
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
    } catch { if (!silent) setSaveStatus('error') }
    if (!silent) setSaving(false)
  }

  async function publicar() {
    const errors = validateFlow(nodes, edges)
    if (errors.length > 0) {
      setValidationErrors(errors)
      setShowValidation(true)
      return
    }
    const newStatus = flowMeta.status === 'active' ? 'inactive' : 'active'
    await salvar()
    await fetch(`/api/fluxos/${flowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setFlowMeta(prev => ({ ...prev, status: newStatus }))
  }

  async function testar() {
    if (!testPhone.trim()) return
    setTesting(true)
    await fetch(`/api/fluxos/${flowId}/testar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone: testPhone.trim() }),
    })
    setTesting(false)
    setShowTestModal(false)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-purple-500" />
      </div>
    )
  }

  const isActive = flowMeta.status === 'active'

  const STATUS_COLORS: Record<string, string> = {
    active: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
    rascunho: 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200',
    pausado: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100',
    inactive: 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200',
  }

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="h-14 bg-white border-b border-gray-100 flex items-center gap-2 px-4 shrink-0">
        <button onClick={() => router.push('/fluxos')} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <input
          value={flowMeta.name}
          onChange={e => setFlowMeta(prev => ({ ...prev, name: e.target.value }))}
          className="font-semibold text-gray-800 bg-transparent border-none outline-none text-sm w-48"
        />

        {/* Status badge */}
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          flowMeta.status === 'active' ? 'bg-green-100 text-green-700' :
          flowMeta.status === 'pausado' ? 'bg-yellow-100 text-yellow-700' :
          'bg-gray-100 text-gray-500'
        }`}>
          {flowMeta.status === 'active' ? 'Ativo' : flowMeta.status === 'pausado' ? 'Pausado' : flowMeta.status === 'rascunho' ? 'Rascunho' : 'Inativo'}
        </span>

        <div className="flex-1" />

        {selectedNodeId && (
          <button onClick={deleteSelectedNode} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg border border-red-200 transition-colors">
            <Trash2 size={14} /> Excluir bloco
          </button>
        )}

        <button onClick={() => setShowTestModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
          <Play size={14} /> Testar
        </button>

        <button
          onClick={publicar}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${STATUS_COLORS[flowMeta.status] ?? STATUS_COLORS.inactive}`}
        >
          <Power size={14} />
          {isActive ? 'Ativo' : 'Ativar'}
        </button>

        <button
          onClick={() => salvar()}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-60 rounded-lg transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Salvar
        </button>

        {saveStatus === 'ok' && <CheckCircle size={16} className="text-green-500" />}
        {saveStatus === 'error' && <AlertCircle size={16} className="text-red-500" />}
      </div>

      {/* Editor area */}
      <div className="flex flex-1 overflow-hidden">
        <BlockPanel onDragStart={handleDragStart} />

        <div className="flex-1 relative" onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            fitView
            deleteKeyCode={null}
          >
            <Background color="#e5e7eb" gap={20} />
            <Controls />
            <MiniMap nodeColor={() => '#8b5cf6'} maskColor="rgba(0,0,0,0.05)" />
            {nodes.length === 0 && (
              <Panel position="top-center">
                <div className="mt-20 text-center text-gray-400 text-sm pointer-events-none">
                  <p className="text-base font-medium">Canvas vazio</p>
                  <p>Arraste blocos da esquerda para começar</p>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* Right panel: node config or flow settings */}
        {selectedNode ? (
          <ConfigPanel node={selectedNode} onChange={updateNodeData} onClose={() => setSelectedNodeId(null)} />
        ) : (
          <FlowSettingsPanel flowMeta={flowMeta} onChange={updateFlowMeta} instancias={instancias} />
        )}
      </div>

      {/* Validation modal */}
      {showValidation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-red-500" />
                <h3 className="font-semibold text-gray-800">Erros de validação</h3>
              </div>
              <button onClick={() => setShowValidation(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-500">Corrija os erros abaixo antes de publicar o fluxo:</p>
            <ul className="space-y-2">
              {validationErrors.map((err, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  {err}
                </li>
              ))}
            </ul>
            <button onClick={() => setShowValidation(false)} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">
              Fechar e corrigir
            </button>
          </div>
        </div>
      )}

      {/* Test modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-xl space-y-4">
            <h3 className="font-semibold text-gray-800">Testar fluxo</h3>
            <p className="text-sm text-gray-500">Informe o número para iniciar o fluxo manualmente.</p>
            <input
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder="5511999999999"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={testar}
                disabled={testing || !testPhone.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
              >
                {testing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {testing ? 'Iniciando...' : 'Testar'}
              </button>
              <button onClick={() => setShowTestModal(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function FlowEditor({ flowId }: { flowId: string }) {
  return (
    <ReactFlowProvider>
      <Editor flowId={flowId} />
    </ReactFlowProvider>
  )
}
