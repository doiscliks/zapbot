'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, ToggleLeft, ToggleRight, Loader2, Bell, CheckCircle, AlertCircle, Copy, Play, ChevronDown, ChevronUp, Pencil, X } from 'lucide-react'

interface Secao { id: number; nome: string }

interface Regra {
  id: string
  status_alvo: string
  tempo_horas: number
  mensagem: string
  ativo: boolean
  limite: number | null
  intervalo_segundos: number | null
  hora_inicio: string | null
  hora_fim: string | null
  max_repeticoes: number | null
  created_at: string
}


function formatarWhatsApp(texto: string): string {
  return texto
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>')
}

export default function RemarketingPage() {
  interface LogEntry { telefone: string; nome: string | null; enviado_em: string; variacao: number | null; http_status: number | null; erro: string | null }

  const [regras, setRegras] = useState<Regra[]>([])
  const [secoes, setSecoes] = useState<Secao[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [executando, setExecutando] = useState(false)
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [logsAbertos, setLogsAbertos] = useState<Record<string, boolean>>({})
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({})
  const [loadingLogs, setLoadingLogs] = useState<Record<string, boolean>>({})
  const [pendentes, setPendentes] = useState<Record<string, number | null>>({})
  const [editando, setEditando] = useState<Regra | null>(null)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  // Form nova regra
  const [statusAlvo, setStatusAlvo] = useState('')
  const [tempoHoras, setTempoHoras] = useState(24)
  const [limite, setLimite] = useState<number | ''>(10)
  const [intervaloSegundos, setIntervaloSegundos] = useState<number>(3)
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFim, setHoraFim] = useState('')
  const [maxRepeticoes, setMaxRepeticoes] = useState<number>(1)
  const [mensagens, setMensagens] = useState<string[]>([''])
  const [previewIdx, setPreviewIdx] = useState(0)
  const [editandoMensagens, setEditandoMensagens] = useState<string[]>([''])
  const [editandoPreviewIdx, setEditandoPreviewIdx] = useState(0)

  useEffect(() => {
    carregarRegras()
    fetch('/api/kanban')
      .then((r) => r.json())
      .then((d) => {
        const lista: Secao[] = (d.secoes ?? []).map((s: Secao) => ({ id: s.id, nome: s.nome }))
        setSecoes(lista)
        if (lista.length > 0) setStatusAlvo(String(lista[0].id))
      })
      .catch(() => {})
  }, [])

  async function carregarPendentes(regras: Regra[]) {
    const resultados = await Promise.all(
      regras.map(async (r) => {
        const res = await fetch(`/api/remarketing/pendentes/${r.id}`)
        const data = await res.json()
        return { id: r.id, pendentes: data.pendentes ?? 0 }
      })
    )
    const mapa: Record<string, number> = {}
    for (const r of resultados) mapa[r.id] = r.pendentes
    setPendentes(mapa)
  }

  // Sincroniza editandoMensagens quando abre o modal de edição
  useEffect(() => {
    if (!editando) return
    try {
      const arr = JSON.parse(editando.mensagem)
      setEditandoMensagens(Array.isArray(arr) && arr.length > 0 ? arr : [editando.mensagem])
    } catch {
      setEditandoMensagens([editando.mensagem])
    }
    setEditandoPreviewIdx(0)
  }, [editando?.id])

  async function toggleLogs(regraId: string) {
    const aberto = logsAbertos[regraId]
    setLogsAbertos((prev) => ({ ...prev, [regraId]: !aberto }))
    if (!aberto && !logs[regraId]) {
      setLoadingLogs((prev) => ({ ...prev, [regraId]: true }))
      const res = await fetch(`/api/remarketing/logs/${regraId}`)
      const data = await res.json()
      setLogs((prev) => ({ ...prev, [regraId]: Array.isArray(data) ? data : [] }))
      setLoadingLogs((prev) => ({ ...prev, [regraId]: false }))
    }
  }

  function mostrarFeedback(tipo: 'ok' | 'erro', msg: string) {
    setFeedback({ tipo, msg })
    setTimeout(() => setFeedback(null), 4000)
  }

  async function carregarRegras() {
    setLoading(true)
    const res = await fetch('/api/remarketing/regras')
    const data = await res.json()
    const lista = Array.isArray(data) ? data : []
    setRegras(lista)
    setLoading(false)
    if (lista.length > 0) carregarPendentes(lista)
  }

  async function criarRegra() {
    const mensagensValidas = mensagens.filter((m) => m.trim())
    if (mensagensValidas.length === 0) return
    setSalvando(true)
    try {
      const res = await fetch('/api/remarketing/regras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status_alvo: statusAlvo,
          tempo_horas: tempoHoras,
          mensagem: JSON.stringify(mensagensValidas),
          limite,
          intervalo_segundos: intervaloSegundos,
          hora_inicio: horaInicio || null,
          hora_fim: horaFim || null,
          max_repeticoes: maxRepeticoes,
        }),
      })
      if (!res.ok) throw new Error('Erro ao criar')
      await carregarRegras()
      setMostrarForm(false)
      setMensagens([''])
      setPreviewIdx(0)
      setTempoHoras(24)
      setLimite(10)
      setIntervaloSegundos(3)
      setHoraInicio('')
      setHoraFim('')
      setMaxRepeticoes(1)
      mostrarFeedback('ok', 'Regra criada com sucesso!')
    } catch {
      mostrarFeedback('erro', 'Erro ao criar regra.')
    } finally {
      setSalvando(false)
    }
  }

  async function salvarEdicao() {
    const mensagensValidas = editandoMensagens.filter((m) => m.trim())
    if (!editando || mensagensValidas.length === 0 || !editando.limite) return
    setSalvandoEdicao(true)
    try {
      const res = await fetch(`/api/remarketing/regras/${editando.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status_alvo: editando.status_alvo,
          tempo_horas: editando.tempo_horas,
          mensagem: JSON.stringify(mensagensValidas),
          limite: editando.limite,
          intervalo_segundos: editando.intervalo_segundos,
          hora_inicio: editando.hora_inicio,
          hora_fim: editando.hora_fim,
          max_repeticoes: editando.max_repeticoes,
        }),
      })
      if (!res.ok) throw new Error()
      const atualizada = await res.json()
      setRegras((prev) => prev.map((r) => r.id === atualizada.id ? atualizada : r))
      setEditando(null)
      mostrarFeedback('ok', 'Regra atualizada!')
    } catch {
      mostrarFeedback('erro', 'Erro ao salvar edição.')
    } finally {
      setSalvandoEdicao(false)
    }
  }

  async function toggleAtivo(regra: Regra) {
    const res = await fetch(`/api/remarketing/regras/${regra.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !regra.ativo }),
    })
    if (res.ok) {
      setRegras((prev) => prev.map((r) => r.id === regra.id ? { ...r, ativo: !r.ativo } : r))
    }
  }

  async function deletarRegra(id: string) {
    if (!confirm('Deletar esta regra?')) return
    const res = await fetch(`/api/remarketing/regras/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setRegras((prev) => prev.filter((r) => r.id !== id))
      mostrarFeedback('ok', 'Regra removida.')
    } else {
      mostrarFeedback('erro', 'Erro ao deletar.')
    }
  }

  async function executarAgora() {
    setExecutando(true)
    try {
      const res = await fetch('/api/remarketing/executar', { method: 'POST' })
      const data = await res.json()
      mostrarFeedback('ok', `Execução concluída: ${data.enviados ?? 0} mensagens enviadas.`)
    } catch {
      mostrarFeedback('erro', 'Erro ao executar.')
    } finally {
      setExecutando(false)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Remarketing Automático</h1>
          <p className="text-gray-500 text-sm mt-1">
            Envie mensagens automaticamente para clientes parados em um status por tempo determinado.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={executarAgora}
            disabled={executando}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {executando ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
            Executar agora
          </button>
          <button
            onClick={() => setMostrarForm(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Nova regra
          </button>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm mb-6 ${
          feedback.tipo === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {feedback.tipo === 'ok' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {feedback.msg}
        </div>
      )}

      {/* Formulário nova regra */}
      {mostrarForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-5">Nova regra de remarketing</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Status alvo</label>
              <select
                value={statusAlvo}
                onChange={(e) => setStatusAlvo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {secoes.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tempo parado (h)</label>
              <input
                type="number"
                min={1}
                value={tempoHoras}
                onChange={(e) => setTempoHoras(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Limite <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min={1}
                placeholder="Ex: 10"
                value={limite}
                onChange={(e) => setLimite(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Intervalo (seg)</label>
              <input
                type="number"
                min={1}
                value={intervaloSegundos}
                onChange={(e) => setIntervaloSegundos(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Janela de horário e repetições */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Horário início</label>
              <input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Horário fim</label>
              <input
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Repetições por cliente</label>
              <input
                type="number"
                min={1}
                value={maxRepeticoes}
                onChange={(e) => setMaxRepeticoes(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex items-end pb-2">
              <p className="text-xs text-gray-400 leading-tight">
                Sem horário = qualquer hora.<br />
                Repetições = quantas vezes cada cliente pode receber.
              </p>
            </div>
          </div>

          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600">
                Mensagens — use{' '}
                <code className="bg-gray-100 px-1 rounded text-xs">{'{{nome_cliente}}'}</code> e{' '}
                <code className="bg-gray-100 px-1 rounded text-xs">{'{{cidade}}'}</code>
              </label>
              <button
                type="button"
                onClick={() => { setMensagens((p) => [...p, '']); setPreviewIdx(mensagens.length) }}
                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium"
              >
                <Plus size={13} /> Adicionar variação
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                {mensagens.map((msg, idx) => (
                  <div key={idx} className="relative">
                    {mensagens.length > 1 && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-medium text-gray-400">Variação {idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const novo = mensagens.filter((_, i) => i !== idx)
                            setMensagens(novo)
                            setPreviewIdx(Math.min(previewIdx, novo.length - 1))
                          }}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                    <textarea
                      value={msg}
                      onChange={(e) => {
                        const novo = [...mensagens]
                        novo[idx] = e.target.value
                        setMensagens(novo)
                        setPreviewIdx(idx)
                      }}
                      onFocus={() => setPreviewIdx(idx)}
                      placeholder="Olá {{nome_cliente}}, tudo bem?..."
                      rows={4}
                      className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none font-mono ${
                        previewIdx === idx ? 'border-green-400' : 'border-gray-300'
                      }`}
                    />
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-medium text-gray-400">Preview</p>
                  {mensagens.length > 1 && (
                    <span className="text-[10px] text-gray-400">— variação {previewIdx + 1}</span>
                  )}
                </div>
                <div className="bg-[#ECE5DD] rounded-lg p-3 min-h-[120px]">
                  {mensagens[previewIdx]?.trim() ? (
                    <div className="bg-white rounded-lg rounded-tr-none shadow-sm px-3 py-2 max-w-[90%] ml-auto">
                      <p
                        className="text-sm text-gray-800 leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: formatarWhatsApp(
                            mensagens[previewIdx]
                              .replace(/\{\{nome_cliente\}\}/gi, 'João')
                              .replace(/\{\{nome\}\}/gi, 'João')
                              .replace(/\{\{cidade\}\}/gi, 'São Paulo')
                          ),
                        }}
                      />
                    </div>
                  ) : (
                    <p className="text-center text-gray-400 text-xs pt-4">Preview da mensagem</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-5">
            <button
              onClick={() => { setMostrarForm(false); setMensagens(['']); setPreviewIdx(0) }}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={criarRegra}
              disabled={salvando || !mensagens.some((m) => m.trim()) || !limite}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Criar regra
            </button>
          </div>
        </div>
      )}

      {/* Lista de regras */}
      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-8">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      ) : regras.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Bell size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Nenhuma regra criada ainda.</p>
          <p className="text-gray-400 text-xs mt-1">
            Clique em &quot;Nova regra&quot; para começar a automatizar seu remarketing.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {regras.map((regra) => (
            <div
              key={regra.id}
              className={`bg-white rounded-xl border shadow-sm p-5 transition-opacity ${
                regra.ativo ? 'border-gray-200 opacity-100' : 'border-gray-100 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {secoes.find((s) => String(s.id) === regra.status_alvo)?.nome ?? regra.status_alvo}
                    </span>
                    <span className="text-xs text-gray-500">
                      parado por <strong>{regra.tempo_horas}h</strong>
                    </span>
                    <span className="text-xs text-gray-500">
                      limite <strong>{regra.limite ?? '—'}</strong>
                    </span>
                    <span className="text-xs text-gray-500">
                      intervalo <strong>{regra.intervalo_segundos ?? 3}s</strong>
                    </span>
                    {regra.hora_inicio && regra.hora_fim && (
                      <span className="text-xs text-gray-500">
                        horário <strong>{regra.hora_inicio}–{regra.hora_fim}</strong>
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      repete <strong>{regra.max_repeticoes ?? 1}×</strong>
                    </span>
                    {pendentes[regra.id] !== undefined ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        pendentes[regra.id]! > 0
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {pendentes[regra.id]} pendente{pendentes[regra.id] !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                    {!regra.ativo && (
                      <span className="text-xs text-gray-400 italic">inativa</span>
                    )}
                  </div>
                  {(() => {
                    let msgs: string[] = []
                    try { msgs = JSON.parse(regra.mensagem); if (!Array.isArray(msgs)) msgs = [regra.mensagem] } catch { msgs = [regra.mensagem] }
                    return (
                      <div className="mb-3">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-2">{msgs[0]}</p>
                        {msgs.length > 1 && (
                          <span className="text-xs text-purple-600 font-medium mt-1 inline-block">
                            +{msgs.length - 1} variação{msgs.length > 2 ? 'ões' : ''} — enviará aleatoriamente
                          </span>
                        )}
                      </div>
                    )
                  })()}

                  {/* Webhook URL */}
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3">
                    <code className="text-xs text-gray-500 truncate flex-1 select-all">
                      {typeof window !== 'undefined' ? window.location.origin : ''}/api/remarketing/executar/{regra.id}
                    </code>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/api/remarketing/executar/${regra.id}`
                        navigator.clipboard.writeText(url)
                        mostrarFeedback('ok', 'Webhook copiado!')
                      }}
                      title="Copiar webhook"
                      className="text-gray-400 hover:text-gray-700 shrink-0"
                    >
                      <Copy size={14} />
                    </button>
                  </div>

                  {/* Botão execuções */}
                  <button
                    onClick={() => toggleLogs(regra.id)}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
                  >
                    {logsAbertos[regra.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    Execuções
                  </button>

                  {/* Lista de logs */}
                  {logsAbertos[regra.id] && (
                    <div className="mt-2 border border-gray-100 rounded-lg overflow-hidden">
                      {loadingLogs[regra.id] ? (
                        <div className="flex items-center gap-2 px-4 py-3 text-gray-400 text-xs">
                          <Loader2 size={13} className="animate-spin" /> Carregando...
                        </div>
                      ) : !logs[regra.id] || logs[regra.id].length === 0 ? (
                        <p className="px-4 py-3 text-xs text-gray-400">Nenhum envio registrado ainda.</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                              <th className="text-left px-4 py-2 font-medium text-gray-500">Nome</th>
                              <th className="text-left px-4 py-2 font-medium text-gray-500">Telefone</th>
                              <th className="text-left px-4 py-2 font-medium text-gray-500">Variação</th>
                              <th className="text-left px-4 py-2 font-medium text-gray-500">Status</th>
                              <th className="text-left px-4 py-2 font-medium text-gray-500">Enviado em</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {logs[regra.id].map((log, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-700">{log.nome || '—'}</td>
                                <td className="px-4 py-2 text-gray-500">{log.telefone}</td>
                                <td className="px-4 py-2 text-gray-400">
                                  {log.variacao != null ? `#${log.variacao + 1}` : '—'}
                                </td>
                                <td className="px-4 py-2">
                                  {log.http_status != null ? (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${
                                      log.http_status >= 200 && log.http_status < 300
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-100 text-red-600'
                                    }`} title={log.erro ?? undefined}>
                                      {log.http_status}
                                    </span>
                                  ) : log.erro ? (
                                    <span className="text-red-400" title={log.erro}>erro</span>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-gray-400">
                                  {new Date(log.enviado_em).toLocaleString('pt-BR', {
                                    day: '2-digit', month: '2-digit', year: '2-digit',
                                    hour: '2-digit', minute: '2-digit'
                                  })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <button
                    onClick={() => setEditando({ ...regra })}
                    title="Editar"
                    className="text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={async () => {
                      const res = await fetch(`/api/remarketing/executar/${regra.id}`, { method: 'POST' })
                      const data = await res.json()
                      mostrarFeedback('ok', `Executado: ${data.enviados ?? 0} enviados`)
                      // Atualiza pendentes e logs desta regra
                      const r = await fetch(`/api/remarketing/pendentes/${regra.id}`)
                      const p = await r.json()
                      setPendentes((prev) => ({ ...prev, [regra.id]: p.pendentes ?? 0 }))
                      setLogs((prev) => ({ ...prev, [regra.id]: undefined as unknown as LogEntry[] }))
                    }}
                    title="Executar agora"
                    className="text-gray-400 hover:text-green-600 transition-colors"
                  >
                    <Play size={16} />
                  </button>
                  <button
                    onClick={() => toggleAtivo(regra)}
                    title={regra.ativo ? 'Desativar' : 'Ativar'}
                    className="text-gray-400 hover:text-green-600 transition-colors"
                  >
                    {regra.ativo ? <ToggleRight size={24} className="text-green-500" /> : <ToggleLeft size={24} />}
                  </button>
                  <button
                    onClick={() => deletarRegra(regra.id)}
                    title="Deletar"
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-6">
        O número de repetições define quantas vezes cada cliente pode receber a mensagem de uma mesma regra. Configure o webhook no n8n com um Schedule a cada 10 minutos.
      </p>

      {/* Modal de edição */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Editar regra</h2>
              <button onClick={() => setEditando(null)} className="text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Linha 1 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status alvo</label>
                  <select
                    value={editando.status_alvo}
                    onChange={(e) => setEditando({ ...editando, status_alvo: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {secoes.map((s) => (
                      <option key={s.id} value={String(s.id)}>{s.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tempo parado (h)</label>
                  <input
                    type="number" min={1}
                    value={editando.tempo_horas}
                    onChange={(e) => setEditando({ ...editando, tempo_horas: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Limite</label>
                  <input
                    type="number" min={1}
                    value={editando.limite ?? ''}
                    onChange={(e) => setEditando({ ...editando, limite: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Intervalo (seg)</label>
                  <input
                    type="number" min={1}
                    value={editando.intervalo_segundos ?? 3}
                    onChange={(e) => setEditando({ ...editando, intervalo_segundos: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Linha 2 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Horário início</label>
                  <input
                    type="time"
                    value={editando.hora_inicio ?? ''}
                    onChange={(e) => setEditando({ ...editando, hora_inicio: e.target.value || null })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Horário fim</label>
                  <input
                    type="time"
                    value={editando.hora_fim ?? ''}
                    onChange={(e) => setEditando({ ...editando, hora_fim: e.target.value || null })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Repetições por cliente</label>
                  <input
                    type="number" min={1}
                    value={editando.max_repeticoes ?? 1}
                    onChange={(e) => setEditando({ ...editando, max_repeticoes: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Mensagens */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-600">
                    Mensagens — use{' '}
                    <code className="bg-gray-100 px-1 rounded text-xs">{'{{nome_cliente}}'}</code> e{' '}
                    <code className="bg-gray-100 px-1 rounded text-xs">{'{{cidade}}'}</code>
                  </label>
                  <button
                    type="button"
                    onClick={() => { setEditandoMensagens((p) => [...p, '']); setEditandoPreviewIdx(editandoMensagens.length) }}
                    className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium"
                  >
                    <Plus size={13} /> Adicionar variação
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    {editandoMensagens.map((msg, idx) => (
                      <div key={idx}>
                        {editandoMensagens.length > 1 && (
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-medium text-gray-400">Variação {idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const novo = editandoMensagens.filter((_, i) => i !== idx)
                                setEditandoMensagens(novo)
                                setEditandoPreviewIdx(Math.min(editandoPreviewIdx, novo.length - 1))
                              }}
                              className="text-gray-300 hover:text-red-400 transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}
                        <textarea
                          value={msg}
                          onChange={(e) => {
                            const novo = [...editandoMensagens]
                            novo[idx] = e.target.value
                            setEditandoMensagens(novo)
                            setEditandoPreviewIdx(idx)
                          }}
                          onFocus={() => setEditandoPreviewIdx(idx)}
                          rows={4}
                          className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none font-mono ${
                            editandoPreviewIdx === idx ? 'border-green-400' : 'border-gray-300'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-medium text-gray-400">Preview</p>
                      {editandoMensagens.length > 1 && (
                        <span className="text-[10px] text-gray-400">— variação {editandoPreviewIdx + 1}</span>
                      )}
                    </div>
                    <div className="bg-[#ECE5DD] rounded-lg p-3 min-h-[120px]">
                      {editandoMensagens[editandoPreviewIdx]?.trim() ? (
                        <div className="bg-white rounded-lg rounded-tr-none shadow-sm px-3 py-2 max-w-[90%] ml-auto">
                          <p
                            className="text-sm text-gray-800 leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: formatarWhatsApp(
                                editandoMensagens[editandoPreviewIdx]
                                  .replace(/\{\{nome_cliente\}\}/gi, 'João')
                                  .replace(/\{\{nome\}\}/gi, 'João')
                                  .replace(/\{\{cidade\}\}/gi, 'São Paulo')
                              ),
                            }}
                          />
                        </div>
                      ) : (
                        <p className="text-center text-gray-400 text-xs pt-4">Preview da mensagem</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 pb-6">
              <button
                onClick={() => setEditando(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvarEdicao}
                disabled={salvandoEdicao || !editando.mensagem.trim() || !editando.limite}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {salvandoEdicao ? <Loader2 size={14} className="animate-spin" /> : null}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
