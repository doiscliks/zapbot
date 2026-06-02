'use client'

import { useEffect, useState, useRef } from 'react'
import {
  BookOpen, Plus, Trash2, Loader2,
  FileText, MessageSquareQuote, AlignLeft, Upload, CheckCircle, AlertCircle, MessageCircle, Wand2, Layers, UserPlus,
} from 'lucide-react'
import { TreinamentoQA, TreinamentoTexto } from '@/types'

type Aba = 'prompt' | 'qa' | 'textos' | 'arquivos' | 'whatsapp' | 'qualificacao' | 'coleta'

type CampoColeta = { chave: string; label: string; descricao: string }

export default function TreinamentoPage() {
  const [aba, setAba] = useState<Aba>('prompt')

  // Prompt
  const [prompt, setPrompt] = useState('')
  const [salvandoPrompt, setSalvandoPrompt] = useState(false)
  const [promptSalvo, setPromptSalvo] = useState(false)

  // Q&A
  const [qas, setQas] = useState<TreinamentoQA[]>([])
  const [novaPergunta, setNovaPergunta] = useState('')
  const [novaResposta, setNovaResposta] = useState('')
  const [adicionandoQA, setAdicionandoQA] = useState(false)
  const [formQAAberto, setFormQAAberto] = useState(false)

  // Textos
  const [textos, setTextos] = useState<TreinamentoTexto[]>([])
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novoConteudo, setNovoConteudo] = useState('')
  const [adicionandoTexto, setAdicionandoTexto] = useState(false)
  const [formTextoAberto, setFormTextoAberto] = useState(false)

  // Arquivos
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadando, setUploadando] = useState(false)

  // WhatsApp import
  const [paresWpp, setParesWpp] = useState<{ pergunta: string; resposta: string }[]>([])
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set())
  const [extraindo, setExtraindo] = useState(false)
  const [refinando, setRefinando] = useState(false)
  const [refinado, setRefinado] = useState(false)
  const [tokensUsados, setTokensUsados] = useState<number | null>(null)
  const [importando, setImportando] = useState(false)
  const [erroWpp, setErroWpp] = useState<string | null>(null)
  const [importadoOk, setImportadoOk] = useState<number | null>(null)

  // IA global
  const [iaAtiva, setIaAtiva] = useState(true)
  const [salvandoIa, setSalvandoIa] = useState(false)

  // Qualificação Kanban
  const [qualAtivo, setQualAtivo] = useState(false)
  const [qualSecoes, setQualSecoes] = useState<{ id: number; nome: string; cor: string | null }[]>([])
  const [qualDescricoes, setQualDescricoes] = useState<Record<number, string>>({})
  const [salvandoQual, setSalvandoQual] = useState(false)
  const [qualSalvo, setQualSalvo] = useState(false)

  // Coleta de dados do cliente
  const [coletaAtivo, setColetaAtivo] = useState(false)
  const [coletaCampos, setColetaCampos] = useState<CampoColeta[]>([])
  const [salvandoColeta, setSalvandoColeta] = useState(false)
  const [coletaSalvo, setColetaSalvo] = useState(false)

  // Erro geral
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    carregarTudo()
  }, [])

  async function carregarTudo() {
    setErro(null)
    const [promptRes, qaRes, textosRes, configRes, qualRes, coletaRes] = await Promise.all([
      fetch('/api/treinamento/prompt'),
      fetch('/api/treinamento/qa'),
      fetch('/api/treinamento/textos'),
      fetch('/api/config/usuario'),
      fetch('/api/treinamento/qualificacao'),
      fetch('/api/treinamento/coleta'),
    ])

    if (promptRes.ok) {
      const d = await promptRes.json()
      setPrompt(d.conteudo ?? '')
    }
    if (qaRes.ok) setQas(await qaRes.json())
    if (textosRes.ok) setTextos(await textosRes.json())
    if (configRes.ok) {
      const cfg = await configRes.json()
      setIaAtiva(cfg.iaAtiva !== false)
    }
    if (qualRes.ok) {
      const d = await qualRes.json()
      setQualAtivo(d.ativo ?? false)
      const descMap: Record<number, string> = {}
      for (const cfg of d.secoes_config ?? []) {
        descMap[cfg.secao_id] = cfg.descricao ?? ''
      }
      setQualDescricoes(descMap)
    }
    if (coletaRes.ok) {
      const d = await coletaRes.json()
      setColetaAtivo(d.ativo ?? false)
      setColetaCampos(Array.isArray(d.campos) ? d.campos.map((c: Partial<CampoColeta>) => ({ chave: c.chave ?? '', label: c.label ?? '', descricao: c.descricao ?? '' })) : [])
    }
  }

  async function toggleIa() {
    const novoValor = !iaAtiva
    setSalvandoIa(true)
    setIaAtiva(novoValor)
    await fetch('/api/config/usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iaAtiva: novoValor }),
    })
    setSalvandoIa(false)
  }

  // --- Prompt ---
  async function salvarPrompt() {
    setSalvandoPrompt(true)
    setPromptSalvo(false)
    const res = await fetch('/api/treinamento/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conteudo: prompt }),
    })
    setSalvandoPrompt(false)
    if (res.ok) {
      setPromptSalvo(true)
      setTimeout(() => setPromptSalvo(false), 3000)
    }
  }

  // --- Q&A ---
  async function adicionarQA() {
    if (!novaPergunta.trim() || !novaResposta.trim()) return
    setAdicionandoQA(true)
    const res = await fetch('/api/treinamento/qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pergunta: novaPergunta, resposta: novaResposta }),
    })
    if (res.ok) {
      const novo = await res.json()
      setQas((prev) => [...prev, novo])
      setNovaPergunta('')
      setNovaResposta('')
      setFormQAAberto(false)
    }
    setAdicionandoQA(false)
  }

  async function deletarQA(id: number) {
    await fetch(`/api/treinamento/qa/${id}`, { method: 'DELETE' })
    setQas((prev) => prev.filter((q) => q.id !== id))
  }

  // --- Textos ---
  async function adicionarTexto() {
    if (!novoTitulo.trim() || !novoConteudo.trim()) return
    setAdicionandoTexto(true)
    const res = await fetch('/api/treinamento/textos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: novoTitulo, conteudo: novoConteudo }),
    })
    if (res.ok) {
      const novo = await res.json()
      setTextos((prev) => [...prev, novo])
      setNovoTitulo('')
      setNovoConteudo('')
      setFormTextoAberto(false)
    }
    setAdicionandoTexto(false)
  }

  async function deletarTexto(id: number) {
    await fetch(`/api/treinamento/textos/${id}`, { method: 'DELETE' })
    setTextos((prev) => prev.filter((t) => t.id !== id))
  }

  // --- Arquivos ---
  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    if (!arquivo.name.endsWith('.txt')) {
      setErro('Apenas arquivos .txt são suportados por enquanto.')
      return
    }
    setUploadando(true)
    setErro(null)
    const conteudo = await arquivo.text()
    const res = await fetch('/api/treinamento/textos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: arquivo.name, conteudo }),
    })
    if (res.ok) {
      const novo = await res.json()
      setTextos((prev) => [...prev, novo])
      setAba('textos')
    }
    setUploadando(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // --- WhatsApp ---
  async function extrairConversas() {
    setExtraindo(true)
    setErroWpp(null)
    setImportadoOk(null)
    setSelecionados(new Set())
    const res = await fetch('/api/treinamento/importar-whatsapp')
    if (res.ok) {
      const data = await res.json()
      setParesWpp(data)
      setSelecionados(new Set(data.map((_: unknown, i: number) => i)))
    } else {
      setErroWpp('Erro ao extrair conversas.')
    }
    setExtraindo(false)
  }

  async function refinarComIA() {
    if (paresWpp.length === 0) return
    setRefinando(true)
    setErroWpp(null)
    const res = await fetch('/api/treinamento/refinar-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pares: paresWpp }),
    })
    const data = await res.json()
    if (res.ok) {
      setParesWpp(data.pares)
      setSelecionados(new Set(data.pares.map((_: unknown, i: number) => i)))
      setTokensUsados(data.tokens)
      setRefinado(true)
    } else {
      setErroWpp(data.error ?? 'Erro ao refinar.')
    }
    setRefinando(false)
  }

  async function importarSelecionados() {
    const pares = paresWpp.filter((_, i) => selecionados.has(i))
    if (pares.length === 0) return
    setImportando(true)
    setErroWpp(null)
    const res = await fetch('/api/treinamento/importar-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pares }),
    })
    const data = await res.json()
    if (res.ok) {
      setImportadoOk(data.importados)
      setParesWpp([])
      setSelecionados(new Set())
      const qaRes = await fetch('/api/treinamento/qa')
      if (qaRes.ok) setQas(await qaRes.json())
    } else {
      setErroWpp(data.error ?? 'Erro ao importar.')
    }
    setImportando(false)
  }

  // --- Qualificação Kanban ---
  useEffect(() => {
    // Ao abrir a aba, recarrega seções e descrições do banco para garantir dados frescos
    if (aba === 'qualificacao') {
      Promise.all([
        fetch('/api/kanban').then((r) => (r.ok ? r.json() : { secoes: [] })),
        fetch('/api/treinamento/qualificacao').then((r) => (r.ok ? r.json() : { ativo: false, secoes_config: [] })),
      ])
        .then(([kanbanData, qualData]) => {
          setQualSecoes(kanbanData.secoes ?? [])
          setQualAtivo(qualData.ativo ?? false)
          const descMap: Record<number, string> = {}
          for (const cfg of qualData.secoes_config ?? []) {
            descMap[cfg.secao_id] = cfg.descricao ?? ''
          }
          setQualDescricoes(descMap)
        })
        .catch(() => {})
    }
  }, [aba])

  async function postarQualificacao(campos: Record<string, unknown>) {
    const res = await fetch('/api/treinamento/qualificacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campos),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setErro(d.error ?? 'Erro ao salvar qualificação. Verifique se a tabela kanban_qualificacao existe no Supabase.')
      return false
    }
    return true
  }

  async function toggleQualificacao() {
    const novoAtivo = !qualAtivo
    setQualAtivo(novoAtivo)
    setSalvandoQual(true)
    // Salva ativo + descrições atuais juntos para não perder nenhum dado
    const secoes_config = Object.entries(qualDescricoes).map(([secao_id, descricao]) => ({
      secao_id: Number(secao_id),
      descricao,
    }))
    await postarQualificacao({ ativo: novoAtivo, secoes_config })
    setSalvandoQual(false)
  }

  async function salvarQualificacao() {
    setSalvandoQual(true)
    setQualSalvo(false)
    const secoes_config = Object.entries(qualDescricoes).map(([secao_id, descricao]) => ({
      secao_id: Number(secao_id),
      descricao,
    }))
    const ok = await postarQualificacao({ secoes_config })
    setSalvandoQual(false)
    if (ok) {
      setQualSalvo(true)
      setTimeout(() => setQualSalvo(false), 3000)
    }
  }

  // --- Coleta de dados ---
  async function postarColeta(campos: Record<string, unknown>) {
    const res = await fetch('/api/treinamento/coleta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campos),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setErro(d.error ?? 'Erro ao salvar. Verifique se a tabela coleta_dados_config existe no Supabase.')
      return false
    }
    return true
  }

  async function toggleColeta() {
    const novo = !coletaAtivo
    setColetaAtivo(novo)
    setSalvandoColeta(true)
    await postarColeta({ ativo: novo, campos: coletaCampos })
    setSalvandoColeta(false)
  }

  async function salvarColeta() {
    setSalvandoColeta(true)
    setColetaSalvo(false)
    const limpos = coletaCampos.filter((c) => c.label.trim())
    const ok = await postarColeta({ campos: limpos })
    setSalvandoColeta(false)
    if (ok) {
      setColetaCampos(limpos)
      setColetaSalvo(true)
      setTimeout(() => setColetaSalvo(false), 3000)
    }
  }

  function addCampoColeta() {
    setColetaCampos((prev) => [...prev, { chave: '', label: '', descricao: '' }])
  }
  function updateCampoColeta(i: number, patch: Partial<CampoColeta>) {
    setColetaCampos((prev) => prev.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  }
  function removeCampoColeta(i: number) {
    setColetaCampos((prev) => prev.filter((_, j) => j !== i))
  }

  const abas: { id: Aba; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'prompt', label: 'Prompt', icon: AlignLeft },
    { id: 'qa', label: 'Perguntas & Respostas', icon: MessageSquareQuote, count: qas.length },
    { id: 'textos', label: 'Textos', icon: FileText, count: textos.length },
    { id: 'arquivos', label: 'Arquivos', icon: Upload },
    { id: 'whatsapp', label: 'Importar do WhatsApp', icon: MessageCircle },
    { id: 'qualificacao', label: 'Qualificação Kanban', icon: Layers },
    { id: 'coleta', label: 'Coleta de dados', icon: UserPlus, count: coletaCampos.length },
  ]

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
            <BookOpen size={18} className="text-purple-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900">Treinamento do Agente</h1>
            <p className="text-xs text-gray-500">Adicione informações e gere a base de conhecimento</p>
          </div>
          <button
            onClick={toggleIa}
            disabled={salvandoIa}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors disabled:opacity-60 ${
              iaAtiva
                ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${iaAtiva ? 'bg-green-500' : 'bg-gray-400'}`} />
            {salvandoIa ? 'Salvando...' : iaAtiva ? 'IA Ativa' : 'IA Pausada'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {erro && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            <AlertCircle size={16} />
            {erro}
          </div>
        )}

        {/* Abas */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-100">
            {abas.map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                onClick={() => setAba(id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                  aba === id
                    ? 'border-purple-500 text-purple-600 bg-purple-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon size={15} />
                {label}
                {count !== undefined && count > 0 && (
                  <span className="ml-1 bg-purple-100 text-purple-600 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Aba: Prompt */}
            {aba === 'prompt' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Defina a personalidade, tom de voz e instruções gerais do agente.
                </p>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={10}
                  placeholder="Ex: Você é um assistente de atendimento da empresa X. Responda sempre de forma educada e objetiva. Nunca forneça preços sem consultar o cliente sobre o produto desejado..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={salvarPrompt}
                    disabled={salvandoPrompt}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {salvandoPrompt ? <Loader2 size={15} className="animate-spin" /> : null}
                    Salvar prompt
                  </button>
                  {promptSalvo && (
                    <span className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle size={14} /> Salvo!
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Aba: Q&A */}
            {aba === 'qa' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Adicione pares de perguntas e respostas frequentes.
                  </p>
                  <button
                    onClick={() => setFormQAAberto((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Plus size={15} /> Adicionar
                  </button>
                </div>

                {formQAAberto && (
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
                    <input
                      type="text"
                      value={novaPergunta}
                      onChange={(e) => setNovaPergunta(e.target.value)}
                      placeholder="Pergunta"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                    <textarea
                      value={novaResposta}
                      onChange={(e) => setNovaResposta(e.target.value)}
                      placeholder="Resposta"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={adicionarQA}
                        disabled={adicionandoQA || !novaPergunta.trim() || !novaResposta.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        {adicionandoQA ? <Loader2 size={14} className="animate-spin" /> : null}
                        Salvar
                      </button>
                      <button
                        onClick={() => { setFormQAAberto(false); setNovaPergunta(''); setNovaResposta('') }}
                        className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {qas.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">Nenhuma pergunta adicionada ainda.</p>
                ) : (
                  <div className="space-y-3">
                    {qas.map((qa) => (
                      <div key={qa.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 group">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800">{qa.pergunta}</p>
                            <p className="text-sm text-gray-500 mt-1">{qa.resposta}</p>
                          </div>
                          <button
                            onClick={() => deletarQA(qa.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Aba: Textos */}
            {aba === 'textos' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Adicione blocos de texto com informações sobre a empresa, produtos, políticas, etc.
                  </p>
                  <button
                    onClick={() => setFormTextoAberto((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Plus size={15} /> Adicionar
                  </button>
                </div>

                {formTextoAberto && (
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
                    <input
                      type="text"
                      value={novoTitulo}
                      onChange={(e) => setNovoTitulo(e.target.value)}
                      placeholder="Título (ex: Horário de funcionamento)"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                    <textarea
                      value={novoConteudo}
                      onChange={(e) => setNovoConteudo(e.target.value)}
                      placeholder="Conteúdo..."
                      rows={5}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={adicionarTexto}
                        disabled={adicionandoTexto || !novoTitulo.trim() || !novoConteudo.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        {adicionandoTexto ? <Loader2 size={14} className="animate-spin" /> : null}
                        Salvar
                      </button>
                      <button
                        onClick={() => { setFormTextoAberto(false); setNovoTitulo(''); setNovoConteudo('') }}
                        className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {textos.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">Nenhum texto adicionado ainda.</p>
                ) : (
                  <div className="space-y-3">
                    {textos.map((texto) => (
                      <div key={texto.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 group">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800">{texto.titulo}</p>
                            <p className="text-sm text-gray-500 mt-1 line-clamp-3">{texto.conteudo}</p>
                          </div>
                          <button
                            onClick={() => deletarTexto(texto.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Aba: WhatsApp */}
            {aba === 'whatsapp' && (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-gray-500">
                      Extrai pares de pergunta e resposta das suas conversas reais do WhatsApp e importa direto para a base de Q&A.
                    </p>
                  </div>
                  <button
                    onClick={extrairConversas}
                    disabled={extraindo}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {extraindo ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
                    {extraindo ? 'Extraindo...' : 'Extrair conversas'}
                  </button>
                </div>

                {erroWpp && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                    <AlertCircle size={15} /> {erroWpp}
                  </div>
                )}

                {importadoOk !== null && (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
                    <CheckCircle size={15} />
                    {importadoOk} par{importadoOk !== 1 ? 'es' : ''} importado{importadoOk !== 1 ? 's' : ''} com sucesso! Clique em &quot;Gerar agora&quot; para atualizar a base.
                  </div>
                )}

                {paresWpp.length > 0 && (
                  <>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <p className="text-sm text-gray-600 font-medium">
                          {paresWpp.length} par{paresWpp.length !== 1 ? 'es' : ''}{' '}
                          {refinado ? (
                            <span className="inline-flex items-center gap-1 text-purple-600 font-semibold">
                              <Wand2 size={12} /> refinados pela IA
                            </span>
                          ) : 'extraídos'} —{' '}
                          <span className="text-gray-400">{selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''}</span>
                        </p>
                        {tokensUsados && (
                          <span className="text-xs text-gray-400">{tokensUsados.toLocaleString('pt-BR')} tokens</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!refinado && (
                          <button
                            onClick={refinarComIA}
                            disabled={refinando}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            {refinando ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                            {refinando ? 'Refinando...' : 'Refinar com IA'}
                          </button>
                        )}
                        <button
                          onClick={() => setSelecionados(selecionados.size === paresWpp.length ? new Set() : new Set(paresWpp.map((_, i) => i)))}
                          className="text-xs text-purple-600 hover:underline"
                        >
                          {selecionados.size === paresWpp.length ? 'Desmarcar todos' : 'Selecionar todos'}
                        </button>
                        <button
                          onClick={importarSelecionados}
                          disabled={importando || selecionados.size === 0}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {importando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                          Importar selecionados
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                      {paresWpp.map((par, i) => (
                        <div
                          key={i}
                          className={`flex items-start gap-3 bg-gray-50 rounded-xl p-4 border transition-colors ${
                            selecionados.has(i) ? 'border-purple-300 bg-purple-50' : 'border-gray-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selecionados.has(i)}
                            onChange={() => {
                              const novo = new Set(selecionados)
                              if (novo.has(i)) novo.delete(i)
                              else novo.add(i)
                              setSelecionados(novo)
                            }}
                            className="mt-0.5 accent-purple-600 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-sm font-medium text-gray-800 leading-snug">{par.pergunta}</p>
                            <p className="text-sm text-gray-500 leading-snug">{par.resposta}</p>
                          </div>
                          <button
                            onClick={() => {
                              const novos = paresWpp.filter((_, j) => j !== i)
                              setParesWpp(novos)
                              const novo = new Set(selecionados)
                              novo.delete(i)
                              // Reindexar selecionados após remoção
                              const reindexado = new Set<number>()
                              for (const idx of novo) {
                                if (idx < i) reindexado.add(idx)
                                else if (idx > i) reindexado.add(idx - 1)
                              }
                              setSelecionados(reindexado)
                            }}
                            title="Remover da lista"
                            className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {paresWpp.length === 0 && !extraindo && importadoOk === null && (
                  <div className="text-center py-10 text-gray-400 text-sm">
                    <MessageCircle size={32} className="mx-auto mb-3 text-gray-300" />
                    Clique em &quot;Extrair conversas&quot; para buscar pares de perguntas e respostas das suas mensagens do WhatsApp.
                  </div>
                )}
              </div>
            )}

            {/* Aba: Qualificação Kanban */}
            {aba === 'qualificacao' && (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Qualificação automática de leads</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Quando ativo, a IA classifica cada lead automaticamente em uma seção do Kanban com base na mensagem recebida.
                    </p>
                  </div>
                  <button
                    onClick={toggleQualificacao}
                    disabled={salvandoQual}
                    className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors disabled:opacity-60 ${
                      qualAtivo
                        ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                        : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${qualAtivo ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {salvandoQual ? 'Salvando...' : qualAtivo ? 'Ativo' : 'Inativo'}
                  </button>
                </div>

                {qualAtivo && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500">
                      Descreva cada seção para que a IA saiba quando classificar o lead nela. Deixe em branco as seções que não devem ser usadas na classificação.
                    </p>

                    {qualSecoes.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-sm">
                        <Layers size={28} className="mx-auto mb-2 text-gray-300" />
                        Nenhuma seção encontrada. Crie seções no Kanban primeiro.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {qualSecoes.map((secao) => (
                          <div key={secao.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                            <div className="flex items-start gap-3">
                              <div
                                className="w-3 h-3 rounded-full mt-1 shrink-0"
                                style={{ backgroundColor: secao.cor || '#94a3b8' }}
                              />
                              <div className="flex-1 space-y-2">
                                <p className="text-sm font-medium text-gray-800">{secao.nome}</p>
                                <textarea
                                  value={qualDescricoes[secao.id] ?? ''}
                                  onChange={(e) =>
                                    setQualDescricoes((prev) => ({ ...prev, [secao.id]: e.target.value }))
                                  }
                                  placeholder="Ex: Lead que perguntou sobre preços ou demonstrou interesse em comprar..."
                                  rows={2}
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {qualSecoes.length > 0 && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={salvarQualificacao}
                          disabled={salvandoQual}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {salvandoQual ? <Loader2 size={15} className="animate-spin" /> : null}
                          Salvar descrições
                        </button>
                        {qualSalvo && (
                          <span className="flex items-center gap-1 text-green-600 text-sm">
                            <CheckCircle size={14} /> Salvo!
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Aba: Coleta de dados */}
            {aba === 'coleta' && (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Coleta automática de dados</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Quando ativo, a IA pede educadamente e captura os dados abaixo durante a conversa, salvando na ficha do cliente.
                    </p>
                  </div>
                  <button
                    onClick={toggleColeta}
                    disabled={salvandoColeta}
                    className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors disabled:opacity-60 ${
                      coletaAtivo
                        ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                        : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${coletaAtivo ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {salvandoColeta ? 'Salvando...' : coletaAtivo ? 'Ativo' : 'Inativo'}
                  </button>
                </div>

                <div className="space-y-3">
                  {coletaCampos.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      <UserPlus size={28} className="mx-auto mb-2 text-gray-300" />
                      Nenhum campo configurado. Adicione os dados que a IA deve coletar (ex: E-mail, Empresa).
                    </div>
                  ) : (
                    coletaCampos.map((campo, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 space-y-2">
                            <input
                              type="text"
                              value={campo.label}
                              onChange={(e) => updateCampoColeta(i, { label: e.target.value })}
                              placeholder="Nome do dado (ex: E-mail)"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                            />
                            <input
                              type="text"
                              value={campo.descricao}
                              onChange={(e) => updateCampoColeta(i, { descricao: e.target.value })}
                              placeholder="Dica para a IA (opcional, ex: e-mail de contato do cliente)"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                            />
                          </div>
                          <button
                            onClick={() => removeCampoColeta(i)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                            title="Remover campo"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  <button
                    onClick={addCampoColeta}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 text-gray-500 hover:text-purple-600 hover:border-purple-300 text-sm font-medium rounded-lg transition-colors"
                  >
                    <Plus size={15} /> Adicionar campo
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={salvarColeta}
                    disabled={salvandoColeta}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {salvandoColeta ? <Loader2 size={15} className="animate-spin" /> : null}
                    Salvar campos
                  </button>
                  {coletaSalvo && (
                    <span className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle size={14} /> Salvo!
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Aba: Arquivos */}
            {aba === 'arquivos' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Faça upload de arquivos <strong>.txt</strong>. O conteúdo será adicionado automaticamente como um bloco de texto.
                </p>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
                >
                  {uploadando ? (
                    <Loader2 size={32} className="text-purple-500 animate-spin" />
                  ) : (
                    <Upload size={32} className="text-gray-400" />
                  )}
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">
                      {uploadando ? 'Processando arquivo...' : 'Clique para selecionar um arquivo'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Apenas .txt por enquanto</p>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  onChange={handleArquivo}
                  className="hidden"
                />

                {textos.length > 0 && (
                  <p className="text-xs text-gray-400 text-center">
                    {textos.length} bloco{textos.length !== 1 ? 's' : ''} de texto salvo{textos.length !== 1 ? 's' : ''} — veja na aba <strong>Textos</strong>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
