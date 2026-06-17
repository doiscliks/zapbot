'use client'

import { useEffect, useState, useRef } from 'react'
import { KanbanSecao, Cliente } from '@/types'
import Avatar from '@/components/Avatar'
import { Plus, X, Loader2, Kanban } from 'lucide-react'
import { STATUS_LIST } from '@/constants/status'

const STATUS_COLUNAS = STATUS_LIST

function DadosColetadosChips({ cliente }: { cliente: Cliente }) {
  const entradas = Object.entries(cliente.dados_coletados ?? {}).filter(([, v]) => v && String(v).trim())
  if (entradas.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1 mt-2">
      {entradas.map(([k, v]) => (
        <span key={k} className="text-[10px] bg-purple-50 text-purple-700 border border-purple-100 px-1.5 py-0.5 rounded font-medium truncate max-w-full">
          <span className="capitalize opacity-70">{k.replace(/_/g, ' ')}:</span> {v}
        </span>
      ))}
    </div>
  )
}

const FB_EVENTOS = [
  { value: 'Lead', label: 'Lead (gerou interesse)' },
  { value: 'Contact', label: 'Contato realizado' },
  { value: 'CompleteRegistration', label: 'Cadastro completo' },
  { value: 'Schedule', label: 'Agendamento' },
  { value: 'SubmitApplication', label: 'Proposta enviada' },
  { value: 'Purchase', label: 'Compra realizada' },
  { value: 'InitiateCheckout', label: 'Iniciou checkout' },
  { value: 'AddToCart', label: 'Adicionou ao carrinho' },
  { value: 'ViewContent', label: 'Visualizou conteúdo' },
  { value: 'Search', label: 'Pesquisou' },
  { value: 'CustomEvent', label: 'Evento personalizado' },
]

const CORES_PRESET = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4', '#64748b', '#1e293b',
]

async function enviarEventoFacebook(
  clientes: { id: number; nome: string; telefone: string }[],
  eventName: string,
  secaoNome: string,
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const res = await fetch('/api/facebook/conversions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientes, eventName }),
    })
    const result = await res.json()
    const erroStr = result.ok === false ? JSON.stringify(result.error) : null
    await fetch('/api/facebook/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientes,
        evento: eventName,
        secao: secaoNome,
        events_received: result.events_received ?? null,
        fbtrace_id: result.fbtrace_id ?? null,
        erro: erroStr,
      }),
    })
    if (!res.ok || result.ok === false) {
      return { ok: false, erro: erroStr ?? `HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Erro desconhecido' }
  }
}

export default function KanbanPage() {
  const [aba, setAba] = useState<'personalizado' | 'por_status'>('personalizado')
  const [secoes, setSecoes] = useState<KanbanSecao[]>([])
  const [clientes, setClientes] = useState<Record<string, Cliente[]>>({})
  const [clientesPorStatus, setClientesPorStatus] = useState<Record<string, Cliente[]>>({})
  const [loading, setLoading] = useState(true)
  const [novaSecao, setNovaSecao] = useState('')
  const [novaSecaoFb, setNovaSecaoFb] = useState(false)
  const [novaSecaoEvento, setNovaSecaoEvento] = useState('Lead')
  const [novaSecaoCor, setNovaSecaoCor] = useState(CORES_PRESET[0])
  const [criando, setCriando] = useState(false)
  const [mostrarInput, setMostrarInput] = useState(false)
  const [dragClienteId, setDragClienteId] = useState<number | null>(null)
  const [dragSobreSecao, setDragSobreSecao] = useState<string | null>(null)
  const [fbNotif, setFbNotif] = useState<{ ok: boolean; msg: string } | null>(null)
  const [erroSecao, setErroSecao] = useState<string | null>(null)
  const fbNotifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function carregar() {
    setLoading(true)
    try {
      const res = await fetch('/api/kanban')
      const data = await res.json()
      setSecoes(data.secoes ?? [])
      setClientes(data.clientes ?? { sem_secao: [] })
      setClientesPorStatus(data.clientesPorStatus ?? {})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])

  useEffect(() => {
    if (mostrarInput) inputRef.current?.focus()
  }, [mostrarInput])

  async function handleCriarSecao(e: React.FormEvent) {
    e.preventDefault()
    if (!novaSecao.trim()) return
    setCriando(true)
    setErroSecao(null)
    try {
      const res = await fetch('/api/kanban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novaSecao, facebook_evento: novaSecaoFb ? novaSecaoEvento : null, cor: novaSecaoCor }),
      })
      const nova = await res.json()
      if (!res.ok) {
        setErroSecao(nova?.error ?? 'Erro ao criar seção')
        return
      }
      setSecoes((prev) => [...prev, nova])
      setClientes((prev) => ({ ...prev, [String(nova.id)]: [] }))
      setNovaSecao('')
      setNovaSecaoFb(false)
      setNovaSecaoEvento('Lead')
      setNovaSecaoCor(CORES_PRESET[0])
      setMostrarInput(false)
    } catch {
      setErroSecao('Erro de conexão ao criar seção')
    } finally {
      setCriando(false)
    }
  }

  async function handleDeletarSecao(id: number) {
    if (!confirm('Deletar esta seção? Os clientes voltarão para "Sem seção".')) return
    await fetch(`/api/kanban/${id}`, { method: 'DELETE' })
    setSecoes((prev) => prev.filter((s) => s.id !== id))
    await carregar()
  }

  async function handleAlterarCor(id: number, cor: string) {
    setSecoes((prev) => prev.map((s) => s.id === id ? { ...s, cor } : s))
    await fetch(`/api/kanban/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cor }) })
  }

  function handleDragStart(e: React.DragEvent, clienteId: number) {
    setDragClienteId(clienteId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent, secaoKey: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragSobreSecao(secaoKey)
  }

  function handleDragLeave() {
    setDragSobreSecao(null)
  }

  async function handleDrop(e: React.DragEvent, secaoKey: string) {
    e.preventDefault()
    setDragSobreSecao(null)
    if (!dragClienteId) return

    const secaoId = secaoKey === 'sem_secao' ? null : Number(secaoKey)

    let clienteMovido: Cliente | undefined
    for (const cols of Object.values(clientes)) {
      const found = cols.find((c) => c.id === dragClienteId)
      if (found) { clienteMovido = found; break }
    }

    setClientes((prev) => {
      const novo = { ...prev }
      for (const key of Object.keys(novo)) {
        const idx = novo[key].findIndex((c) => c.id === dragClienteId)
        if (idx !== -1) {
          novo[key] = novo[key].filter((c) => c.id !== dragClienteId)
          break
        }
      }
      if (clienteMovido) {
        if (!novo[secaoKey]) novo[secaoKey] = []
        novo[secaoKey] = [...novo[secaoKey], { ...clienteMovido, kanban_secao_id: secaoId }]
      }
      return novo
    })

    setDragClienteId(null)
    await fetch('/api/kanban/mover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId: dragClienteId, secaoId }) })

    const secaoDestino = secoes.find((s) => String(s.id) === secaoKey)
    if (secaoDestino?.facebook_evento && clienteMovido) {
      enviarEventoFacebook(
        [{ id: clienteMovido.id, nome: clienteMovido.nome, telefone: clienteMovido.telefone }],
        secaoDestino.facebook_evento,
        secaoDestino.nome,
      ).then((r) => {
        if (fbNotifTimerRef.current) clearTimeout(fbNotifTimerRef.current)
        setFbNotif(r.ok
          ? { ok: true, msg: `Evento "${secaoDestino.facebook_evento}" enviado ao Facebook` }
          : { ok: false, msg: `Erro Facebook: ${r.erro}` }
        )
        fbNotifTimerRef.current = setTimeout(() => setFbNotif(null), 5000)
      })
    }
  }

  const colunas: { key: string; nome: string; secaoId?: number; facebookEvento?: string | null; cor?: string | null }[] = [
    { key: 'sem_secao', nome: 'Sem seção', cor: '#94a3b8' },
    ...secoes.map((s) => ({ key: String(s.id), nome: s.nome, secaoId: s.id, facebookEvento: s.facebook_evento, cor: s.cor })),
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Notificação Facebook */}
      {fbNotif && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transition-all text-white"
          style={{ background: fbNotif.ok ? '#12C6D6' : '#ef4444', boxShadow: fbNotif.ok ? '0 4px 20px rgba(18,198,214,0.4)' : '0 4px 20px rgba(239,68,68,0.4)' }}
        >
          {fbNotif.ok ? '✓' : '✗'} {fbNotif.msg}
        </div>
      )}
      {/* Header */}
      <div className="shrink-0 px-8 py-6 border-b bg-white flex items-center justify-between" style={{ borderColor: '#E9EEF2' }}>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#1F2937' }}>
            <Kanban size={22} style={{ color: '#12C6D6' }} /> Kanban
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>{secoes.length} seções · {Object.values(clientes).flat().length} clientes</p>
          {/* Abas */}
          <div className="flex gap-1 mt-3 p-1 rounded-xl" style={{ backgroundColor: '#F0FAFB' }}>
            <button
              onClick={() => setAba('personalizado')}
              className="px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-150"
              style={aba === 'personalizado'
                ? { background: 'linear-gradient(135deg, #12C6D6 0%, #0FBDCC 100%)', color: 'white', boxShadow: '0 2px 8px rgba(18,198,214,0.3)' }
                : { color: '#6B7280' }}
            >
              Personalizado
            </button>
            <button
              onClick={() => setAba('por_status')}
              className="px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-150"
              style={aba === 'por_status'
                ? { background: 'linear-gradient(135deg, #12C6D6 0%, #0FBDCC 100%)', color: 'white', boxShadow: '0 2px 8px rgba(18,198,214,0.3)' }
                : { color: '#6B7280' }}
            >
              Por Status
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {aba === 'personalizado' && mostrarInput ? (
            <form onSubmit={handleCriarSecao} className="flex flex-col items-end gap-2">
              {erroSecao && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 w-full text-center">
                  {erroSecao}
                </p>
              )}
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={novaSecao}
                  onChange={(e) => setNovaSecao(e.target.value)}
                  placeholder="Nome da seção..."
                  className="px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 w-48" style={{ borderColor: '#E9EEF2', '--tw-ring-color': '#12C6D6' } as React.CSSProperties}
                />
                <button
                  type="submit"
                  disabled={criando || !novaSecao.trim()}
                  className="px-4 py-2 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all" style={{ background: 'linear-gradient(135deg, #12C6D6 0%, #0FBDCC 100%)' }}
                >
                  {criando ? <Loader2 size={14} className="animate-spin" /> : 'Criar'}
                </button>
                <button
                  type="button"
                  onClick={() => { setMostrarInput(false); setNovaSecao(''); setNovaSecaoFb(false) }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Cor */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Cor:</span>
                {CORES_PRESET.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => setNovaSecaoCor(cor)}
                    className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: cor,
                      borderColor: novaSecaoCor === cor ? '#111' : 'transparent',
                    }}
                  />
                ))}
              </div>

              {/* Toggle Facebook */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={novaSecaoFb}
                    onChange={(e) => setNovaSecaoFb(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-blue-600 font-medium">Enviar ao Facebook</span>
                </label>
                {novaSecaoFb && (
                  <select
                    value={novaSecaoEvento}
                    onChange={(e) => setNovaSecaoEvento(e.target.value)}
                    className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {FB_EVENTOS.map((ev) => (
                      <option key={ev.value} value={ev.value}>{ev.label}</option>
                    ))}
                  </select>
                )}
              </div>
            </form>
          ) : aba === 'personalizado' ? (
            <button
              onClick={() => setMostrarInput(true)}
              className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-xl transition-all"
              style={{ background: 'linear-gradient(135deg, #12C6D6 0%, #0FBDCC 100%)', boxShadow: '0 2px 8px rgba(18,198,214,0.3)' }}
            >
              <Plus size={16} /> Nova seção
            </button>
          ) : null}
        </div>
      </div>

      {/* Board Por Status */}
      {aba === 'por_status' && (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-4 h-full px-8 py-6" style={{ minWidth: 'max-content' }}>
            {STATUS_COLUNAS.map(({ key, label, cor }) => {
              const cards = clientesPorStatus[key] ?? []
              return (
                <div key={key} className="flex flex-col w-72 shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cor }} />
                    <span className="font-semibold text-sm" style={{ color: '#1F2937' }}>{label}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F0FAFB', color: '#12C6D6' }}>
                      {cards.length}
                    </span>
                  </div>
                  <div className="h-1 rounded-full mb-2" style={{ backgroundColor: cor }} />
                  <div
                    className="flex-1 rounded-xl p-2 space-y-2 overflow-y-auto border-2 border-transparent"
                    style={{ minHeight: '200px', maxHeight: 'calc(100vh - 240px)', backgroundColor: '#F8FAFC' }}
                  >
                    {cards.length === 0 && (
                      <div className="flex items-center justify-center h-20 text-gray-400 text-xs">
                        Nenhum cliente
                      </div>
                    )}
                    {cards.map((cliente) => (
                      <div
                        key={cliente.id}
                        className="bg-white rounded-xl p-3 transition-all"
                      style={{ border: '1px solid #E9EEF2', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar nome={cliente.nome} foto={cliente.foto} size="sm" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{cliente.nome}</p>
                            <p className="text-xs text-gray-400 truncate">{cliente.cidade || cliente.telefone}</p>
                            {(cliente as any).usuarios?.nome && (
                              <p className="text-[10px] text-gray-500 truncate mt-1">👤 {(cliente as any).usuarios.nome}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {/* Coluna de clientes sem status ou com status não mapeado */}
            {(() => {
              const keysConhecidas = new Set(STATUS_LIST.map((s) => s.key))
              const semStatus = Object.entries(clientesPorStatus)
                .filter(([key]) => !keysConhecidas.has(key))
                .flatMap(([, lista]) => lista)
              if (semStatus.length === 0) return null
              return (
                <div className="flex flex-col w-72 shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full shrink-0 bg-gray-400" />
                    <span className="font-semibold text-gray-800 text-sm">Sem Status</span>
                    <span className="text-xs bg-gray-200 text-gray-600 font-medium px-2 py-0.5 rounded-full">
                      {semStatus.length}
                    </span>
                  </div>
                  <div className="h-1 rounded-full mb-2 bg-gray-400" />
                  <div
                    className="flex-1 rounded-xl p-2 space-y-2 overflow-y-auto border-2 border-transparent"
                    style={{ minHeight: '200px', maxHeight: 'calc(100vh - 240px)', backgroundColor: '#F8FAFC' }}
                  >
                    {semStatus.map((cliente) => (
                      <div
                        key={cliente.id}
                        className="bg-white rounded-xl p-3 transition-all"
                      style={{ border: '1px solid #E9EEF2', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar nome={cliente.nome} foto={cliente.foto} size="sm" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{cliente.nome}</p>
                            <p className="text-xs text-gray-400 truncate">{cliente.status_atual || 'sem status'}</p>
                            {(cliente as any).usuarios?.nome && (
                              <p className="text-[10px] text-gray-500 truncate mt-1">👤 {(cliente as any).usuarios.nome}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Board Personalizado */}
      {aba === 'personalizado' && <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 h-full px-8 py-6" style={{ minWidth: 'max-content' }}>
          {colunas.map(({ key, nome, secaoId, facebookEvento, cor }) => {
            const cards = clientes[key] ?? []
            const isDragOver = dragSobreSecao === key
            const corAtiva = cor ?? '#94a3b8'

            return (
              <div
                key={key}
                className="flex flex-col w-72 shrink-0"
                onDragOver={(e) => handleDragOver(e, key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, key)}
              >
                {/* Cabeçalho da coluna */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {/* Bolinha de cor clicável */}
                    {secaoId ? (
                      <div className="relative group">
                        <button
                          type="button"
                          className="w-3 h-3 rounded-full shrink-0 ring-2 ring-offset-1 ring-transparent group-hover:ring-gray-300 transition-all"
                          style={{ backgroundColor: corAtiva }}
                        />
                        {/* Dropdown de cores */}
                        <div className="absolute left-0 top-5 z-10 hidden group-hover:flex flex-wrap gap-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 w-32">
                          {CORES_PRESET.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => handleAlterarCor(secaoId, c)}
                              className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                              style={{
                                backgroundColor: c,
                                borderColor: corAtiva === c ? '#111' : 'transparent',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: corAtiva }} />
                    )}
                    <span className="font-semibold text-sm" style={{ color: '#1F2937' }}>{nome}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F0FAFB', color: '#12C6D6' }}>
                      {cards.length}
                    </span>
                    {facebookEvento && (
                      <span
                        className="text-xs bg-blue-100 text-blue-600 font-medium px-2 py-0.5 rounded-full"
                        title={`Envia evento "${facebookEvento}" ao Facebook`}
                      >
                        fb: {facebookEvento}
                      </span>
                    )}
                  </div>
                  {secaoId && (
                    <button
                      onClick={() => handleDeletarSecao(secaoId)}
                      className="p-1 text-gray-300 hover:text-red-400 transition-colors rounded"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Linha colorida no topo da coluna */}
                <div className="h-1 rounded-full mb-2" style={{ backgroundColor: corAtiva }} />

                {/* Coluna */}
                <div
                  className={`flex-1 rounded-xl p-2 space-y-2 overflow-y-auto transition-colors ${
                    isDragOver
                      ? 'border-2 border-dashed'
                      : 'border-2 border-transparent'
                  }`}
                  style={{
                    minHeight: '200px',
                    maxHeight: 'calc(100vh - 240px)',
                    backgroundColor: isDragOver ? 'rgba(18,198,214,0.04)' : '#F8FAFC',
                    borderColor: isDragOver ? '#12C6D6' : 'transparent',
                  }}
                >
                  {cards.length === 0 && (
                    <div className="flex items-center justify-center h-20 text-xs" style={{ color: '#9CA3AF' }}>
                      Arraste clientes aqui
                    </div>
                  )}

                  {cards.map((cliente) => (
                    <div
                      key={cliente.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, cliente.id)}
                      className="bg-white rounded-xl p-3 cursor-grab active:cursor-grabbing select-none transition-all hover:-translate-y-0.5"
                      style={{ border: '1px solid #E9EEF2', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(18,198,214,0.12)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)' }}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar nome={cliente.nome} foto={cliente.foto} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{cliente.nome}</p>
                          <p className="text-xs text-gray-400 truncate">{cliente.cidade || cliente.telefone}</p>
                          {(cliente as any).usuarios?.nome && (
                            <p className="text-[10px] text-gray-500 truncate mt-1">👤 {(cliente as any).usuarios.nome}</p>
                          )}
                        </div>
                      </div>
                      <DadosColetadosChips cliente={cliente} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>}
    </div>
  )
}
