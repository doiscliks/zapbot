'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, Zap, Edit2, Copy, Trash2, Power, Play, AlertCircle, ChevronRight, ChevronLeft, Activity } from 'lucide-react'

interface Flow {
  id: string
  name: string
  description: string
  status: string
  flow_type: string
  trigger_type: string
  created_at: string
  updated_at: string
  execution_count?: number
}

const FLOW_TYPE_LABELS: Record<string, string> = {
  chatbot: 'Chatbot',
  primeiro_atendimento: '1º Atendimento',
  remarketing: 'Remarketing',
  manual: 'Manual',
  kanban: 'CRM / Kanban',
}

const FLOW_TYPE_COLORS: Record<string, string> = {
  chatbot: 'bg-blue-50 text-blue-700',
  primeiro_atendimento: 'bg-green-50 text-green-700',
  remarketing: 'bg-orange-50 text-orange-700',
  manual: 'bg-gray-100 text-gray-600',
  kanban: 'bg-indigo-50 text-indigo-700',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  rascunho: 'Rascunho',
  pausado: 'Pausado',
  inactive: 'Inativo',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  rascunho: 'bg-gray-100 text-gray-500',
  pausado: 'bg-yellow-100 text-yellow-700',
  inactive: 'bg-gray-100 text-gray-500',
}

const TRIGGER_LABELS: Record<string, string> = {
  nova_mensagem: 'Nova mensagem',
  primeiro_contato: 'Primeiro contato',
  palavra_chave: 'Palavra-chave',
  status_alterado: 'Status alterado',
  tag_adicionada: 'Tag adicionada',
  sem_resposta: 'Sem resposta',
  disparo_manual: 'Manual',
  agendamento: 'Agendado',
  webhook_recebido: 'Webhook',
  kanban_status_change: 'Mudança de coluna',
}

const TRIGGERS_BY_TYPE: Record<string, { value: string; label: string; desc: string }[]> = {
  chatbot: [
    { value: 'nova_mensagem', label: 'Nova mensagem recebida', desc: 'Qualquer mensagem recebida inicia o fluxo' },
    { value: 'primeiro_contato', label: 'Primeiro contato', desc: 'Apenas na primeira mensagem do contato' },
    { value: 'palavra_chave', label: 'Palavra-chave', desc: 'Quando o contato enviar uma palavra específica' },
  ],
  primeiro_atendimento: [
    { value: 'primeiro_contato', label: 'Primeiro contato', desc: 'Quando um novo contato entrar pela primeira vez' },
    { value: 'nova_mensagem', label: 'Nova mensagem', desc: 'Qualquer nova mensagem recebida' },
  ],
  remarketing: [
    { value: 'agendamento', label: 'Agendamento recorrente', desc: 'Disparar em horários pré-definidos' },
    { value: 'status_alterado', label: 'Status alterado no CRM', desc: 'Quando o status do lead mudar' },
    { value: 'tag_adicionada', label: 'Tag adicionada', desc: 'Quando uma tag for adicionada ao contato' },
    { value: 'sem_resposta', label: 'Tempo sem resposta', desc: 'Quando o contato não responder em X horas' },
  ],
  manual: [
    { value: 'disparo_manual', label: 'Disparo manual', desc: 'Iniciado manualmente para contatos selecionados' },
  ],
  kanban: [
    { value: 'kanban_status_change', label: 'Lead muda de coluna', desc: 'Dispara quando um lead for movido para uma coluna específica do Kanban' },
  ],
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ── Wizard ───────────────────────────────────────────────────────────────────

const FLOW_TYPES = [
  { value: 'chatbot', label: 'Chatbot', icon: '🤖', desc: 'Conversa automatizada com perguntas, condições e respostas dinâmicas' },
  { value: 'primeiro_atendimento', label: 'Primeiro Atendimento', icon: '👋', desc: 'Recebe novos contatos automaticamente e faz a triagem inicial' },
  { value: 'remarketing', label: 'Remarketing', icon: '📢', desc: 'Disparos em massa ou agendados para contatos existentes' },
  { value: 'manual', label: 'Disparo Manual', icon: '🎯', desc: 'Você escolhe quando e para quem disparar o fluxo' },
  { value: 'kanban', label: 'CRM / Kanban', icon: '🔄', desc: 'Dispara automaticamente quando um lead muda de coluna no Kanban' },
]

interface WizardData {
  name: string
  description: string
  flow_type: string
  trigger_type: string
  keyword: string
  kanban_secao_id: string
  kanban_secao_nome: string
}

function Wizard({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>({ name: '', description: '', flow_type: 'chatbot', trigger_type: 'nova_mensagem', keyword: '', kanban_secao_id: '', kanban_secao_nome: '' })
  const [creating, setCreating] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [kanbanSecoes, setKanbanSecoes] = useState<{ id: number; nome: string }[]>([])

  useEffect(() => {
    fetch('/api/kanban').then(r => r.json()).then(d => setKanbanSecoes(d ?? [])).catch(() => {})
  }, [])

  function set(key: keyof WizardData, val: string) {
    setData(prev => {
      const next = { ...prev, [key]: val }
      if (key === 'flow_type') {
        const triggers = TRIGGERS_BY_TYPE[val]
        next.trigger_type = triggers?.[0]?.value ?? 'nova_mensagem'
      }
      return next
    })
  }

  async function criar() {
    if (!data.name.trim()) return
    setCreating(true)
    setErro(null)
    const res = await fetch('/api/fluxos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name.trim(),
        description: data.description.trim(),
        flow_type: data.flow_type,
        trigger_type: data.trigger_type,
        trigger_config: data.trigger_type === 'kanban_status_change'
        ? { kanban_secao_id: parseInt(data.kanban_secao_id), kanban_secao_nome: data.kanban_secao_nome }
        : data.keyword ? { keyword: data.keyword } : {},
      }),
    })
    if (res.ok) {
      const d = await res.json()
      onCreated(d.id)
    } else {
      setErro('Erro ao criar fluxo')
      setCreating(false)
    }
  }

  const triggers = TRIGGERS_BY_TYPE[data.flow_type] ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-800">Novo Fluxo</h3>
            <p className="text-xs text-gray-400">Etapa {step} de 2</p>
          </div>
          <div className="flex gap-1">
            <div className={`w-8 h-1.5 rounded-full ${step >= 1 ? 'bg-[var(--brand-primary)]' : 'bg-gray-200'}`} />
            <div className={`w-8 h-1.5 rounded-full ${step >= 2 ? 'bg-[var(--brand-primary)]' : 'bg-gray-200'}`} />
          </div>
        </div>

        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Nome do fluxo *</label>
                <input
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                  placeholder="Ex: Atendimento Vendas"
                  value={data.name}
                  onChange={e => set('name', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && data.name.trim() && setStep(2)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Descrição (opcional)</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] resize-none"
                  placeholder="Qual é o objetivo deste fluxo?"
                  value={data.description}
                  onChange={e => set('description', e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-2">Tipo do fluxo</label>
                <div className="grid grid-cols-2 gap-2">
                  {FLOW_TYPES.map(ft => (
                    <label
                      key={ft.value}
                      className={`flex flex-col gap-1 p-3 rounded-xl border-2 cursor-pointer transition-colors ${data.flow_type === ft.value ? 'border-[var(--brand-primary)] bg-[#E8F9FB]' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <input type="radio" name="flow_type" value={ft.value} checked={data.flow_type === ft.value} onChange={() => set('flow_type', ft.value)} className="sr-only" />
                      <span className="text-lg">{ft.icon}</span>
                      <span className="text-xs font-semibold text-gray-800">{ft.label}</span>
                      <span className="text-[11px] text-gray-400 leading-tight">{ft.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Como o fluxo <strong>{data.name}</strong> será ativado?</p>
              <div className="space-y-2">
                {triggers.map(t => (
                  <label
                    key={t.value}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${data.trigger_type === t.value ? 'border-[var(--brand-primary)] bg-[#E8F9FB]' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <input type="radio" name="trigger_type" value={t.value} checked={data.trigger_type === t.value} onChange={() => set('trigger_type', t.value)} className="mt-1 accent-[var(--brand-primary)]" />
                    <span>
                      <span className="text-sm font-semibold text-gray-800 block">{t.label}</span>
                      <span className="text-xs text-gray-400">{t.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
              {data.trigger_type === 'palavra_chave' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Palavra-chave</label>
                  <input
                    autoFocus
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                    placeholder="Ex: oi, olá, quero"
                    value={data.keyword}
                    onChange={e => set('keyword', e.target.value)}
                  />
                </div>
              )}
              {data.trigger_type === 'kanban_status_change' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Coluna do Kanban que dispara o fluxo</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                    value={data.kanban_secao_id}
                    onChange={e => {
                      const selected = kanbanSecoes.find(s => String(s.id) === e.target.value)
                      setData(prev => ({ ...prev, kanban_secao_id: e.target.value, kanban_secao_nome: selected?.nome ?? '' }))
                    }}
                  >
                    <option value="">Selecionar coluna...</option>
                    {kanbanSecoes.map(s => (
                      <option key={s.id} value={String(s.id)}>{s.nome}</option>
                    ))}
                  </select>
                  {kanbanSecoes.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">Crie colunas no Kanban primeiro para poder vinculá-las aqui.</p>
                  )}
                </div>
              )}
              {erro && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                  <AlertCircle size={14} /> {erro}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 pb-5">
          <button onClick={step === 1 ? onClose : () => setStep(1)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            <ChevronLeft size={15} /> {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>
          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              disabled={!data.name.trim()}
              className="flex items-center gap-1.5 px-5 py-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] disabled:opacity-50 text-white text-sm font-medium rounded-lg"
            >
              Próximo <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={criar}
              disabled={creating || (data.trigger_type === 'kanban_status_change' && !data.kanban_secao_id)}
              className="flex items-center gap-1.5 px-5 py-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] disabled:opacity-50 text-white text-sm font-medium rounded-lg"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              {creating ? 'Criando...' : 'Criar e editar fluxo'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Listagem ─────────────────────────────────────────────────────────────────

export default function FluxosPage() {
  const router = useRouter()
  const [flows, setFlows] = useState<Flow[]>([])
  const [loading, setLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const res = await fetch('/api/fluxos')
    if (res.ok) setFlows(await res.json())
    setLoading(false)
  }

  async function toggleStatus(flow: Flow) {
    const newStatus = flow.status === 'active' ? 'inactive' : 'active'
    await fetch(`/api/fluxos/${flow.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setFlows(prev => prev.map(f => f.id === flow.id ? { ...f, status: newStatus } : f))
  }

  async function duplicar(flow: Flow) {
    const res = await fetch(`/api/fluxos/${flow.id}/duplicar`, { method: 'POST' })
    if (res.ok) carregar()
  }

  async function excluir(flow: Flow) {
    if (!confirm(`Excluir o fluxo "${flow.name}"?`)) return
    await fetch(`/api/fluxos/${flow.id}`, { method: 'DELETE' })
    setFlows(prev => prev.filter(f => f.id !== flow.id))
  }

  const allTypes = Array.from(new Set(flows.map(f => f.flow_type).filter(Boolean)))
  const filtered = flows.filter(f => {
    if (filterType !== 'all' && f.flow_type !== filterType) return false
    if (filterStatus !== 'all' && f.status !== filterStatus) return false
    return true
  })

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center">
            <Zap size={18} className="text-[var(--brand-primary)]" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900">Fluxos de Automação</h1>
            <p className="text-xs text-gray-500">{flows.length} fluxo{flows.length !== 1 ? 's' : ''} criado{flows.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus size={16} /> Criar Fluxo
          </button>
        </div>

        {/* Filters */}
        {flows.length > 0 && (
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {['all', ...allTypes].map(t => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filterType === t ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {t === 'all' ? 'Todos' : FLOW_TYPE_LABELS[t] ?? t}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {['all', 'active', 'rascunho', 'pausado', 'inactive'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filterStatus === s ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {s === 'all' ? 'Todos' : STATUS_LABELS[s] ?? s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-[var(--brand-primary)]" />
          </div>
        ) : flows.length === 0 ? (
          <div className="text-center py-20">
            <Zap size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">Nenhum fluxo criado ainda</p>
            <p className="text-sm text-gray-400 mt-1">Clique em &quot;Criar Fluxo&quot; para começar</p>
            <button onClick={() => setShowWizard(true)} className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-sm font-medium rounded-xl">
              <Plus size={15} /> Criar meu primeiro fluxo
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Nenhum fluxo encontrado com esses filtros.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(flow => (
              <div key={flow.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${flow.status === 'active' ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <Zap size={18} className={flow.status === 'active' ? 'text-green-600' : 'text-gray-400'} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-800 text-sm">{flow.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[flow.status] ?? STATUS_COLORS.inactive}`}>
                        {STATUS_LABELS[flow.status] ?? flow.status}
                      </span>
                      {flow.flow_type && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FLOW_TYPE_COLORS[flow.flow_type] ?? 'bg-gray-100 text-gray-600'}`}>
                          {FLOW_TYPE_LABELS[flow.flow_type] ?? flow.flow_type}
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#E8F9FB] text-[var(--brand-primary)] font-medium">
                        {TRIGGER_LABELS[flow.trigger_type] ?? flow.trigger_type}
                      </span>
                    </div>
                    {flow.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{flow.description}</p>}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                      <span>Criado {formatDate(flow.created_at)}</span>
                      <span>·</span>
                      <span>Editado {formatDate(flow.updated_at)}</span>
                      {(flow.execution_count ?? 0) > 0 && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Activity size={10} />
                            {flow.execution_count} execuç{(flow.execution_count ?? 0) !== 1 ? 'ões' : 'ão'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => router.push(`/fluxos/${flow.id}`)}
                      title="Editar"
                      className="p-2 rounded-lg text-gray-400 hover:text-[var(--brand-primary)] hover:bg-[#E8F9FB] transition-colors"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => {
                        const tel = prompt('Número para teste (ex: 5511999999999):')
                        if (tel) fetch(`/api/fluxos/${flow.id}/testar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefone: tel }) })
                      }}
                      title="Testar"
                      className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Play size={15} />
                    </button>
                    <button
                      onClick={() => toggleStatus(flow)}
                      title={flow.status === 'active' ? 'Desativar' : 'Ativar'}
                      className={`p-2 rounded-lg transition-colors ${flow.status === 'active' ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                    >
                      <Power size={15} />
                    </button>
                    <button
                      onClick={() => duplicar(flow)}
                      title="Duplicar"
                      className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      onClick={() => excluir(flow)}
                      title="Excluir"
                      className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showWizard && (
        <Wizard
          onClose={() => setShowWizard(false)}
          onCreated={(id) => router.push(`/fluxos/${id}`)}
        />
      )}
    </div>
  )
}
