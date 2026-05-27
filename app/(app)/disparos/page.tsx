'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Send, CheckCircle, AlertCircle, Loader2, ChevronRight, MessageSquare, Users, FileText, X, Smartphone } from 'lucide-react'

type Step = 1 | 2 | 3 | 4

interface Contato {
  nome: string
  telefone: string
}

interface Campanha {
  id: string
  nome: string
  mensagem: string
  total: number
  enviados: number
  erros: number
  status: string
  created_at: string
}

interface Instancia {
  id: string
  nome: string
  telefone: string | null
  status: string
}

function formatarWhatsApp(texto: string): string {
  return texto
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/~(.*?)~/g, '<s>$1</s>')
    .replace(/\n/g, '<br/>')
}

const STEPS = [
  { n: 1, label: 'Campanha' },
  { n: 2, label: 'Destinatários' },
  { n: 3, label: 'Mensagem' },
  { n: 4, label: 'Conclusão' },
]

export default function DisparosPage() {
  const [view, setView] = useState<'lista' | 'nova'>('lista')
  const [step, setStep] = useState<Step>(1)
  const [nomeCampanha, setNomeCampanha] = useState('')
  const [contatos, setContatos] = useState<Contato[]>([])
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ enviados: number; erros: number } | null>(null)
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [loadingLista, setLoadingLista] = useState(true)
  const [emojiAberto, setEmojiAberto] = useState(false)
  const [instancias, setInstancias] = useState<Instancia[]>([])
  const [instanciaId, setInstanciaId] = useState<string>('')
  const [loadingInstancias, setLoadingInstancias] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)

  const EMOJIS = [
    '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇',
    '🙂','😉','😍','🥰','😘','😗','😙','😚','🤗','🤩',
    '😎','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️',
    '😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡',
    '🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤔',
    '🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦',
    '👍','👎','👌','✌️','🤞','🤟','🤙','👋','🙏','💪',
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💯',
    '🔥','⭐','✨','🎉','🎊','🎁','🏆','👑','💰','💎',
    '✅','❌','⚠️','📢','📣','💬','📱','💻','🛒','🚀',
  ]

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setEmojiAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function inserirEmoji(emoji: string) {
    const textarea = document.getElementById('editor-msg') as HTMLTextAreaElement
    if (!textarea) return
    const start = textarea.selectionStart
    const novo = mensagem.slice(0, start) + emoji + mensagem.slice(start)
    setMensagem(novo)
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + emoji.length, start + emoji.length)
    }, 0)
  }

  // Carrega instâncias conectadas ao entrar no step 4
  useEffect(() => {
    if (step === 4) carregarInstancias()
  }, [step])

  async function carregarInstancias() {
    setLoadingInstancias(true)
    const res = await fetch('/api/instancias')
    if (res.ok) {
      const data: Instancia[] = await res.json()
      const conectadas = data.filter((i) => i.status === 'conectado')
      setInstancias(conectadas)
      if (conectadas.length === 1) setInstanciaId(conectadas[0].id)
    }
    setLoadingInstancias(false)
  }

  async function carregarListaCampanhas() {
    setLoadingLista(true)
    const res = await fetch('/api/disparos')
    const data = await res.json()
    setCampanhas(data)
    setLoadingLista(false)
  }

  useEffect(() => {
    if (view === 'lista') carregarListaCampanhas()
  }, [view])

  function parsearCSV(texto: string): Contato[] {
    const linhas = texto.trim().split('\n').map(l => l.trim()).filter(Boolean)
    if (!linhas.length) return []
    const primeira = linhas[0].toLowerCase()
    const temHeader = primeira.includes('nome') || primeira.includes('telefone') || primeira.includes('phone')
    const dados = temHeader ? linhas.slice(1) : linhas
    return dados.map(linha => {
      const cols = linha.split(/[,;|\t]/).map(c => c.trim().replace(/"/g, ''))
      if (cols.length >= 2) {
        const isTel = (v: string) => /^\+?[\d\s\-()]+$/.test(v)
        if (isTel(cols[1])) return { nome: cols[0], telefone: cols[1].replace(/\D/g, '') }
        if (isTel(cols[0])) return { nome: cols[1], telefone: cols[0].replace(/\D/g, '') }
      }
      return { nome: '', telefone: cols[0].replace(/\D/g, '') }
    }).filter(c => c.telefone.length >= 8)
  }

  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const texto = ev.target?.result as string
      setContatos(parsearCSV(texto))
    }
    reader.readAsText(file)
  }

  async function enviarCampanha() {
    if (!instanciaId) return
    setEnviando(true)
    try {
      const res = await fetch('/api/disparos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nomeCampanha, mensagem, contatos }),
      })
      const { id, error } = await res.json()
      if (error) throw new Error(error)

      const resEnvio = await fetch(`/api/disparos/${id}/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instancia_id: instanciaId }),
      })
      const dados = await resEnvio.json()
      if (!resEnvio.ok) throw new Error(dados.error ?? 'Erro ao enviar')
      setResultado({ enviados: dados.enviados, erros: dados.erros })
    } catch (e) {
      alert('Erro ao enviar: ' + String(e))
    } finally {
      setEnviando(false)
    }
  }

  function resetar() {
    setStep(1)
    setNomeCampanha('')
    setContatos([])
    setMensagem('')
    setResultado(null)
    setInstanciaId('')
    setInstancias([])
    setView('lista')
  }

  function inserirFormatacao(tag: string) {
    const textarea = document.getElementById('editor-msg') as HTMLTextAreaElement
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const sel = mensagem.slice(start, end)
    const novo = mensagem.slice(0, start) + tag + (sel || 'texto') + tag + mensagem.slice(end)
    setMensagem(novo)
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + tag.length, start + tag.length + (sel || 'texto').length)
    }, 0)
  }

  const podeAvancar =
    (step === 1 && nomeCampanha.trim().length > 0) ||
    (step === 2 && contatos.length > 0) ||
    (step === 3 && mensagem.trim().length > 0)

  const instanciaSelecionada = instancias.find((i) => i.id === instanciaId)

  // ---- LISTA ----
  if (view === 'lista') {
    return (
      <div className="p-4 md:p-8">
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Disparos</h1>
            <p className="text-gray-500 text-sm mt-1">Envio em massa via WhatsApp</p>
          </div>
          <button
            onClick={() => setView('nova')}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Send size={16} />
            Nova campanha
          </button>
        </div>

        {loadingLista ? (
          <div className="flex items-center gap-3 text-gray-500">
            <Loader2 size={20} className="animate-spin" />
            <span>Carregando...</span>
          </div>
        ) : campanhas.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <MessageSquare size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Nenhuma campanha criada ainda.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Campanha</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Mensagem</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Total</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Enviados</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Erros</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campanhas.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        {c.nome}
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          c.status === 'enviado' ? 'bg-green-100 text-green-700' :
                          c.status === 'erro' ? 'bg-red-100 text-red-600' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {c.status === 'enviado' ? 'enviado' : c.status === 'erro' ? 'erro' : 'pendente'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{c.mensagem}</td>
                    <td className="px-4 py-4 text-center text-gray-700">{c.total ?? '—'}</td>
                    <td className="px-4 py-4 text-center text-green-600 font-semibold">{c.enviados ?? '—'}</td>
                    <td className="px-4 py-4 text-center text-red-400">{c.erros ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-400">
                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ---- WIZARD ----
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Nova campanha</h1>
        <button onClick={resetar} className="text-gray-400 hover:text-gray-600">
          <X size={22} />
        </button>
      </div>

      {/* Steps */}
      <div className="flex items-center justify-center mb-10">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                step === s.n
                  ? 'border-green-600 bg-green-600 text-white'
                  : step > s.n
                  ? 'border-green-600 bg-green-50 text-green-600'
                  : 'border-gray-300 bg-white text-gray-400'
              }`}>
                {step > s.n ? <CheckCircle size={18} /> : s.n}
              </div>
              <span className={`text-xs font-medium ${step === s.n ? 'text-green-600' : 'text-gray-400'}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-16 md:w-24 h-0.5 mb-5 mx-1 ${step > s.n ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Nome */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Nome da campanha</h2>
          <p className="text-sm text-gray-500 mb-6">Dê um nome para identificar este disparo.</p>
          <input
            type="text"
            value={nomeCampanha}
            onChange={(e) => setNomeCampanha(e.target.value)}
            placeholder="Ex: Promoção Abril, Remarketing Carrinho..."
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            autoFocus
          />
        </div>
      )}

      {/* Step 2: CSV */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Destinatários</h2>
          <p className="text-sm text-gray-500 mb-6">
            Importe um CSV com as colunas <strong>nome</strong> e <strong>telefone</strong> (com DDI, ex: 5535912345678).
          </p>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCSV} />
          {contatos.length === 0 ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center gap-3 hover:border-green-400 hover:bg-green-50 transition-colors"
            >
              <Upload size={32} className="text-gray-400" />
              <span className="text-sm text-gray-500">Clique para importar o CSV</span>
              <span className="text-xs text-gray-400">Formatos aceitos: .csv, .txt — separador: vírgula, ponto-e-vírgula ou tab</span>
            </button>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-green-600">
                  <Users size={18} />
                  <span className="text-sm font-semibold">{contatos.length} contatos importados</span>
                </div>
                <button
                  onClick={() => { setContatos([]); if (fileRef.current) fileRef.current.value = '' }}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Trocar arquivo
                </button>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Nome</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Telefone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {contatos.slice(0, 100).map((c, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-gray-700">{c.nome || '—'}</td>
                        <td className="px-4 py-2 text-gray-500">{c.telefone}</td>
                      </tr>
                    ))}
                    {contatos.length > 100 && (
                      <tr>
                        <td colSpan={2} className="px-4 py-2 text-center text-gray-400 text-xs">
                          +{contatos.length - 100} contatos não exibidos
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Mensagem */}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Mensagem</h2>
          <p className="text-sm text-gray-500 mb-6">
            Use <code className="bg-gray-100 px-1 rounded">{'{{nome}}'}</code> para personalizar com o nome do contato.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-1 mb-2">
                <button onClick={() => inserirFormatacao('*')} className="px-2.5 py-1 text-sm font-bold border border-gray-200 rounded hover:bg-gray-100" title="Negrito">B</button>
                <button onClick={() => inserirFormatacao('_')} className="px-2.5 py-1 text-sm italic border border-gray-200 rounded hover:bg-gray-100" title="Itálico">I</button>
                <button onClick={() => inserirFormatacao('~')} className="px-2.5 py-1 text-sm line-through border border-gray-200 rounded hover:bg-gray-100" title="Tachado">S</button>
                <div ref={emojiRef} className="relative">
                  <button onClick={() => setEmojiAberto(v => !v)} className="px-2.5 py-1 text-sm border border-gray-200 rounded hover:bg-gray-100">😊</button>
                  {emojiAberto && (
                    <div className="absolute left-0 top-8 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-72">
                      <div className="grid grid-cols-10 gap-1 max-h-48 overflow-y-auto">
                        {EMOJIS.map((e) => (
                          <button key={e} onClick={() => inserirEmoji(e)} className="text-xl hover:bg-gray-100 rounded p-0.5 leading-none">{e}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <textarea
                id="editor-msg"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Digite sua mensagem aqui..."
                rows={10}
                maxLength={1000}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">{mensagem.length}/1000 caracteres</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Preview</p>
              <div className="rounded-xl overflow-hidden border border-gray-200">
                <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-400" />
                  <div>
                    <p className="text-white text-sm font-medium">{contatos[0]?.nome || 'Cliente'}</p>
                    <p className="text-green-200 text-xs">online</p>
                  </div>
                </div>
                <div className="bg-[#ECE5DD] min-h-48 p-4 flex flex-col justify-end">
                  {mensagem ? (
                    <div className="bg-white rounded-lg rounded-tr-none shadow-sm px-3 py-2 max-w-[85%] self-end">
                      <p
                        className="text-sm text-gray-800 leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: formatarWhatsApp(mensagem.replace(/\{\{nome\}\}/gi, contatos[0]?.nome || 'Cliente'))
                        }}
                      />
                      <p className="text-[10px] text-gray-400 text-right mt-1">
                        {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ) : (
                    <p className="text-center text-gray-400 text-xs">A mensagem aparecerá aqui</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Conclusão */}
      {step === 4 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          {resultado ? (
            <div className="text-center py-4">
              <CheckCircle size={52} className="text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Campanha enviada!</h2>
              <div className="flex items-center justify-center gap-8 mt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">{resultado.enviados}</p>
                  <p className="text-sm text-gray-500 mt-1">Enviados</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-400">{resultado.erros}</p>
                  <p className="text-sm text-gray-500 mt-1">Erros</p>
                </div>
              </div>
              <button onClick={resetar} className="mt-8 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">
                Ver campanhas
              </button>
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Resumo do disparo</h2>
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <FileText size={18} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Campanha</p>
                    <p className="text-sm text-gray-800 font-semibold">{nomeCampanha}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <Users size={18} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Destinatários</p>
                    <p className="text-sm text-gray-800 font-semibold">{contatos.length} contatos</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <MessageSquare size={18} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Mensagem</p>
                    <p className="text-sm text-gray-800 line-clamp-3">{mensagem}</p>
                  </div>
                </div>

                {/* Seletor de instância */}
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <Smartphone size={18} className="text-gray-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 font-medium mb-2">Disparar pelo número</p>
                    {loadingInstancias ? (
                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <Loader2 size={14} className="animate-spin" /> Carregando instâncias...
                      </div>
                    ) : instancias.length === 0 ? (
                      <div className="flex items-center gap-2 text-red-600 text-sm">
                        <AlertCircle size={14} />
                        Nenhum número WhatsApp conectado. Acesse <strong>Conexão</strong> para conectar um número.
                      </div>
                    ) : instancias.length === 1 ? (
                      <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        {instancias[0].nome}
                        {instancias[0].telefone && (
                          <span className="font-normal text-gray-500">· {instancias[0].telefone}</span>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {instancias.map((inst) => (
                          <label
                            key={inst.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              instanciaId === inst.id
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name="instancia"
                              value={inst.id}
                              checked={instanciaId === inst.id}
                              onChange={() => setInstanciaId(inst.id)}
                              className="accent-green-600"
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-800">{inst.nome}</p>
                              {inst.telefone && (
                                <p className="text-xs text-gray-500">{inst.telefone}</p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {enviando ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2 size={32} className="animate-spin text-green-600" />
                  <p className="text-sm text-gray-500">Enviando mensagens... não feche esta janela.</p>
                </div>
              ) : (
                <button
                  onClick={enviarCampanha}
                  disabled={!instanciaId || instancias.length === 0}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Send size={18} />
                  {instanciaId
                    ? `Enviar para ${contatos.length} contatos via ${instanciaSelecionada?.nome ?? ''}`
                    : 'Selecione um número para disparar'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Navegação */}
      {step < 4 && (
        <div className="flex justify-between mt-6">
          <button
            onClick={() => step > 1 ? setStep((step - 1) as Step) : resetar()}
            className="px-5 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>
          <button
            onClick={() => setStep((step + 1) as Step)}
            disabled={!podeAvancar}
            className="flex items-center gap-2 px-5 py-2.5 text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-medium transition-colors"
          >
            Avançar <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
