'use client'

import { useEffect, useRef, useState } from 'react'
import { MensagemWhatsapp, Cliente, KanbanSecao } from '@/types'
import { Loader2, MessageSquare, Send, ChevronDown, AlertCircle, RotateCcw, BotOff, Bot, History } from 'lucide-react'

import Avatar from './Avatar'
import { getSecoes, moverClienteParaSecao } from '@/services/kanbanService'

interface Props {
  cliente: Cliente | null
  mensagens: MensagemWhatsapp[]
  loading: boolean
  onMensagemEnviada?: (msg: MensagemWhatsapp) => void
}

function extrairTexto(mensagem: string): string | null {
  if (!mensagem) return null
  const texto = mensagem.trim()
  if (texto.startsWith('{')) {
    try {
      const obj = JSON.parse(texto)
      return obj?.text?.trim() || obj?.caption?.trim() || null
    } catch {
      console.log('[CHAT] Erro ao parse JSON:', texto.slice(0, 100))
      return null
    }
  }
  return texto || null
}

function formatarDataHora(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ChatMensagens({ cliente, mensagens, loading, onMensagemEnviada }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [texto, setTexto] = useState('')
  const [errosPorId, setErrosPorId] = useState<Record<number, string>>({})
  const [statusPorId, setStatusPorId] = useState<Record<number, string>>({})
  const [secoes, setSecoes] = useState<KanbanSecao[]>([])
  const [secaoAtual, setSecaoAtual] = useState<number | null>(null)
  const [salvandoSecao, setSalvandoSecao] = useState(false)
  const [iaDesabilitada, setIaDesabilitada] = useState<boolean>(false)
  const [salvandoIa, setSalvandoIa] = useState(false)
  const [importandoHistorico, setImportandoHistorico] = useState(false)
  const [feedbackImport, setFeedbackImport] = useState<string | null>(null)
  const [estaNoFinal, setEstaNoFinal] = useState(true)

  useEffect(() => {
    getSecoes().then(setSecoes).catch(() => {})
  }, [])

  useEffect(() => {
    setSecaoAtual(cliente?.kanban_secao_id ?? null)
    setIaDesabilitada(cliente?.ia_desabilitada ?? false)
  }, [cliente?.id])

  async function handleImportarHistorico() {
    if (!cliente) return
    setImportandoHistorico(true)
    setFeedbackImport(null)
    try {
      const res = await fetch('/api/mensagens/importar-historico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: cliente.telefone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao importar')
      setFeedbackImport(`${data.importados} mensagens importadas`)
      setTimeout(() => setFeedbackImport(null), 4000)
    } catch (e: unknown) {
      setFeedbackImport(e instanceof Error ? e.message : 'Erro ao importar')
      setTimeout(() => setFeedbackImport(null), 4000)
    } finally {
      setImportandoHistorico(false)
    }
  }

  async function handleToggleIa() {
    if (!cliente) return
    const novoValor = !iaDesabilitada
    setIaDesabilitada(novoValor)
    setSalvandoIa(true)
    try {
      await fetch(`/api/clientes/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ia_desabilitada: novoValor }),
      })
    } finally {
      setSalvandoIa(false)
    }
  }

  async function handleMudarSecao(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!cliente) return
    const valor = e.target.value
    const novaSecaoId = valor === '' ? null : Number(valor)
    setSecaoAtual(novaSecaoId)
    setSalvandoSecao(true)
    try {
      await moverClienteParaSecao(cliente.id, novaSecaoId)
    } finally {
      setSalvandoSecao(false)
    }
  }

  // Detecta se usuário está no final da conversa
  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    setEstaNoFinal(scrollHeight - scrollTop - clientHeight < 50)
  }

  // Scroll automático apenas se estiver no final
  useEffect(() => {
    if (estaNoFinal) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' })
    }
  }, [mensagens, estaNoFinal])

  async function enviarMensagem(mensagemTexto: string, msgId: number) {
    if (!cliente) return
    try {
      // O servidor envia via uazapi E persiste a mensagem com o user_id do workspace
      const res = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: cliente.telefone, mensagem: mensagemTexto }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Erro ao enviar')
      }
      setErrosPorId((prev) => { const n = { ...prev }; delete n[msgId]; return n })
      setStatusPorId((prev) => ({ ...prev, [msgId]: 'enviada' }))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao enviar mensagem'
      setErrosPorId((prev) => ({ ...prev, [msgId]: msg }))
    }
  }

  async function handleEnviar() {
    if (!texto.trim() || !cliente) return

    const mensagemTexto = texto.trim()
    const msgId = Date.now()
    const agora = new Date().toISOString()

    const msgOtimista: MensagemWhatsapp = {
      id: msgId,
      cliente_id: cliente.id,
      numero_cliente: cliente.telefone,
      mensagem: mensagemTexto,
      quem_mandou: 'manual',
      status: 'processando',
      lote_id: null,
      data_criacao: agora,
    }
    onMensagemEnviada?.(msgOtimista)
    setTexto('')
    inputRef.current?.focus()

    // Envia em background — input já liberado
    enviarMensagem(mensagemTexto, msgId)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEnviar()
    }
  }

  if (!cliente) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4 bg-gray-50">
        <MessageSquare size={52} strokeWidth={1.2} />
        <div className="text-center">
          <p className="font-medium text-gray-600">Selecione um cliente</p>
          <p className="text-sm mt-1">Escolha uma conversa na lista ao lado</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 bg-white shrink-0">
        <Avatar nome={cliente.nome} foto={cliente.foto} size="lg" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">{cliente.nome}</p>
          <p className="text-xs text-gray-400">{cliente.telefone}{cliente.cidade ? ` · ${cliente.cidade}` : ''}</p>
          {(cliente.origem_app || cliente.origem_url) && (
            <div className="flex items-center gap-1.5 mt-0.5">
              {cliente.origem_app && (
                <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium capitalize">
                  {cliente.origem_app}
                </span>
              )}
              {cliente.origem_url && (
                <a
                  href={cliente.origem_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-gray-400 hover:text-blue-500 truncate max-w-[200px]"
                >
                  {cliente.origem_url.replace('https://www.facebook.com/', 'fb.com/')}
                </a>
              )}
            </div>
          )}
          {cliente.dados_coletados && Object.entries(cliente.dados_coletados).filter(([, v]) => v && String(v).trim()).length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {Object.entries(cliente.dados_coletados)
                .filter(([, v]) => v && String(v).trim())
                .map(([k, v]) => (
                  <span key={k} className="text-[10px] bg-purple-50 text-purple-700 border border-purple-100 px-1.5 py-0.5 rounded font-medium">
                    <span className="capitalize opacity-70">{k.replace(/_/g, ' ')}:</span> {v}
                  </span>
                ))}
            </div>
          )}
        </div>
        <button
          onClick={handleImportarHistorico}
          disabled={importandoHistorico}
          title="Importar histórico do WhatsApp"
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-60"
        >
          {importandoHistorico ? <Loader2 size={14} className="animate-spin" /> : <History size={14} />}
          {importandoHistorico ? 'Importando...' : 'Histórico'}
        </button>
        <button
          onClick={handleToggleIa}
          disabled={salvandoIa}
          title={iaDesabilitada ? 'IA desabilitada — clique para habilitar' : 'IA habilitada — clique para desabilitar'}
          className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-60 ${
            iaDesabilitada
              ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
              : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
          }`}
        >
          {iaDesabilitada ? <BotOff size={14} /> : <Bot size={14} />}
          {iaDesabilitada ? 'IA off' : 'IA on'}
        </button>
        <div className="relative shrink-0">
          <select
            value={secaoAtual ?? ''}
            onChange={handleMudarSecao}
            disabled={salvandoSecao}
            className="appearance-none pl-3 pr-7 py-1.5 text-xs bg-gray-100 border border-gray-200 rounded-lg text-gray-700 outline-none focus:ring-2 focus:ring-green-500 cursor-pointer disabled:opacity-60"
          >
            <option value="">Sem seção</option>
            {secoes.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {feedbackImport && (
        <div className="px-5 py-2 text-xs text-center bg-blue-50 border-b border-blue-100 text-blue-700">
          {feedbackImport}
        </div>
      )}

      {/* Messages area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 space-y-3 bg-[#f0f2f5]">
        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        )}

        {!loading && (() => {
          const visiveis = mensagens
            .map((msg) => ({ msg, texto: extrairTexto(msg.mensagem) }))
            .filter(({ texto }) => texto !== null)

          console.log('[CHAT] Renderizando:', { totalMensagens: mensagens.length, visiveis: visiveis.length })

          if (mensagens.length === 0 || visiveis.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 py-16">
                <MessageSquare size={36} strokeWidth={1.5} />
                <p className="text-sm">Nenhuma mensagem encontrada</p>
              </div>
            )
          }
          return visiveis.map(({ msg, texto }) => {
            const quem = msg.quem_mandou?.toLowerCase()
            const isCliente = quem === 'cliente'
            const isManual = quem === 'manual'
            const erro = errosPorId[msg.id]
            const isAudioMsg = msg.media_type === 'audio'
            const isImageMsg = msg.media_type === 'image'
            return (
              <div key={msg.id} className={`flex ${isCliente ? 'justify-start' : 'justify-end'}`}>
                <div className={`flex items-end gap-1.5 ${isCliente ? 'flex-row' : 'flex-row-reverse'}`}>
                  {erro && (
                    <button
                      onClick={() => enviarMensagem(msg.mensagem, msg.id)}
                      title={erro}
                      className="text-red-500 hover:text-red-600 shrink-0 mb-1"
                    >
                      <AlertCircle size={16} />
                    </button>
                  )}
                  <div
                    className={`max-w-[70%] rounded-2xl shadow-sm overflow-hidden ${
                      erro
                        ? 'bg-red-100 text-red-800 rounded-tr-sm'
                        : isCliente
                        ? 'bg-white text-gray-800 rounded-tl-sm'
                        : isManual
                        ? 'bg-blue-500 text-white rounded-tr-sm'
                        : 'bg-green-500 text-white rounded-tr-sm'
                    }`}
                  >
                    {/* Imagem */}
                    {isImageMsg && msg.media_url && (
                      <a href={msg.media_url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={msg.media_url}
                          alt="imagem"
                          className="max-w-[280px] max-h-[300px] object-cover w-full"
                        />
                      </a>
                    )}

                    {/* Áudio */}
                    {isAudioMsg && msg.media_url && (
                      <div className="px-3 pt-3 pb-1">
                        <audio controls src={msg.media_url} className="w-full max-w-[260px] h-9" />
                      </div>
                    )}

                    {/* Texto / transcrição */}
                    <div className="px-4 py-2.5">
                      {isAudioMsg && texto && (
                        <p className={`text-[11px] italic mb-1 ${isCliente ? 'text-gray-400' : 'text-white/60'}`}>
                          &ldquo;{texto}&rdquo;
                        </p>
                      )}
                      {!isAudioMsg && !isImageMsg && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{texto}</p>
                      )}
                      {isImageMsg && texto && (
                        <p className={`text-[11px] italic mt-1 ${isCliente ? 'text-gray-400' : 'text-white/60'}`}>
                          {texto}
                        </p>
                      )}
                      <div className={`flex items-center gap-1 mt-1 ${isCliente ? 'justify-start' : 'justify-end'}`}>
                        <span className={`text-[10px] ${erro ? 'text-red-400' : isCliente ? 'text-gray-400' : isManual ? 'text-blue-100' : 'text-green-100'}`}>
                          {formatarDataHora(msg.data_criacao)}
                        </span>
                        {erro ? (
                          <button onClick={() => enviarMensagem(msg.mensagem, msg.id)} className="text-[10px] text-red-500 flex items-center gap-0.5 hover:underline">
                            <RotateCcw size={10} /> Tentar novamente
                          </button>
                        ) : !isCliente && (
                          <span className={`text-[10px] ${isManual ? 'text-blue-100' : 'text-green-100'}`}>
                            · {statusPorId[msg.id] ?? msg.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        })()}

        <div ref={bottomRef} />
      </div>

      {/* Input de envio */}
      <div className="shrink-0 bg-white border-t border-gray-200 px-4 py-3">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem... (Enter para enviar)"
            rows={1}
            className="flex-1 resize-none bg-gray-100 rounded-2xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-green-500 max-h-32 overflow-y-auto"
            style={{ lineHeight: '1.5' }}
          />
          <button
            onClick={handleEnviar}
            disabled={!texto.trim()}
            className="w-10 h-10 rounded-full bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
          >
            <Send size={18} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
