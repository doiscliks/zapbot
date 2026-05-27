'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, Loader2, CheckCircle, Eye, EyeOff, Wifi, WifiOff, Activity, Key, GripVertical } from 'lucide-react'

const MASKED = '••••••••••••••••••••••'

interface ConfigForm {
  supabaseUrl: string
  supabaseAnonKey: string
  uazapiUrl: string
  uazapiToken: string
  openaiKey: string
  fbPixelId: string
  fbAccessToken: string
  fbTestEventCode: string
  fbAdsToken: string
  fbAdAccountId: string
  instanciasPermitidas: string
}

export default function SetupPage() {
  const router = useRouter()
  const [form, setForm] = useState<ConfigForm>({
    supabaseUrl: '',
    supabaseAnonKey: '',
    uazapiUrl: '',
    uazapiToken: '',
    openaiKey: '',
    fbPixelId: '',
    fbAccessToken: '',
    fbTestEventCode: '',
    fbAdsToken: '',
    fbAdAccountId: '',
    instanciasPermitidas: '1',
  })
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mostrarToken, setMostrarToken] = useState(false)
  const [mostrarKey, setMostrarKey] = useState(false)
  const [mostrarOpenai, setMostrarOpenai] = useState(false)
  const [mostrarFbToken, setMostrarFbToken] = useState(false)
  const [mostrarFbAdsToken, setMostrarFbAdsToken] = useState(false)
  const [testandoFb, setTestandoFb] = useState(false)
  const [fbTesteResult, setFbTesteResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [testandoUazapi, setTestandoUazapi] = useState(false)
  const [uazapiTesteResult, setUazapiTesteResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // Template global de prompt
  const [template, setTemplate] = useState('')
  const [salvandoTemplate, setSalvandoTemplate] = useState(false)
  const [templateSalvo, setTemplateSalvo] = useState(false)
  const templateRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Carregar config atual
    fetch('/api/treinamento/template')
      .then((r) => r.json())
      .then((data) => setTemplate(data.conteudo ?? ''))
      .catch(() => {})

    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        setForm((prev) => ({
          ...prev,
          supabaseUrl: data.supabaseUrl || '',
          supabaseAnonKey: data.supabaseAnonKey || '',
          uazapiUrl: data.uazapiUrl || '',
          uazapiToken: data.hasUazapiToken ? MASKED : '',
          openaiKey: data.hasOpenaiKey ? MASKED : '',
          fbPixelId: data.fbPixelId || '',
          fbAccessToken: data.hasFbAccessToken ? MASKED : '',
          fbTestEventCode: data.fbTestEventCode || '',
          fbAdsToken: data.hasFbAdsToken ? MASKED : '',
          fbAdAccountId: data.fbAdAccountId || '',
          instanciasPermitidas: data.instanciasPermitidas ?? '1',
        }))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function handleChange(field: keyof ConfigForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSucesso(false)
    setErro(null)
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setSucesso(false)
    setSalvando(true)

    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (res.status === 401) {
      router.replace('/setup/login')
      return
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      setErro(errData.error ? `Erro: ${errData.error}` : 'Erro ao salvar configurações.')
      setSalvando(false)
      return
    }

    setSucesso(true)
    setSalvando(false)
  }

  async function handleTestarFb() {
    setTestandoFb(true)
    setFbTesteResult(null)
    try {
      const res = await fetch('/api/facebook/conversions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientes: [{ nome: 'Teste Lino', telefone: '11999999999' }],
          eventName: 'Lead',
        }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setFbTesteResult({ ok: true, msg: `Evento recebido pelo Facebook! (events_received: ${data.events_received})` })
      } else {
        setFbTesteResult({ ok: false, msg: `Erro: ${JSON.stringify(data.error ?? data)}` })
      }
    } catch (e) {
      setFbTesteResult({ ok: false, msg: e instanceof Error ? e.message : 'Erro de rede' })
    } finally {
      setTestandoFb(false)
    }
  }

  async function handleTestarUazapi() {
    setTestandoUazapi(true)
    setUazapiTesteResult(null)
    try {
      const res = await fetch('/api/config/test-uazapi')
      const data = await res.json()
      if (data.ok) {
        setUazapiTesteResult({ ok: true, msg: `Conectado! (${data.base})` })
      } else {
        setUazapiTesteResult({ ok: false, msg: data.error ? `Erro ${data.status ?? ''}: ${data.error}` : 'Falha na conexão' })
      }
    } catch (e) {
      setUazapiTesteResult({ ok: false, msg: e instanceof Error ? e.message : 'Erro de rede' })
    } finally {
      setTestandoUazapi(false)
    }
  }

  function inserirBloco(placeholder: string) {
    const ta = templateRef.current
    if (!ta) return
    const start = ta.selectionStart ?? template.length
    const end = ta.selectionEnd ?? template.length
    const novo = template.slice(0, start) + placeholder + template.slice(end)
    setTemplate(novo)
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + placeholder.length
      ta.focus()
    }, 0)
  }

  async function salvarTemplate() {
    setSalvandoTemplate(true)
    setTemplateSalvo(false)
    await fetch('/api/treinamento/template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conteudo: template }),
    })
    setSalvandoTemplate(false)
    setTemplateSalvo(true)
    setTimeout(() => setTemplateSalvo(false), 3000)
  }

  function handleIrParaApp() {
    window.location.href = '/dashboard'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-4 py-12">
      <div className="w-full max-w-xl mx-auto">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gray-700 flex items-center justify-center mb-4 shadow-lg">
            <Settings size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Painel Master</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie o sistema e acompanhe os clientes</p>
        </div>

        {/* Navegação */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="flex flex-col items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-4 py-4 text-white">
            <Settings size={20} />
            <span className="text-xs font-medium">Configurações</span>
          </div>
          <a
            href="/setup/diagnostico"
            className="flex flex-col items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl px-4 py-4 text-gray-400 hover:text-white transition-colors"
          >
            <Activity size={20} />
            <span className="text-xs font-medium">Diagnóstico</span>
          </a>
          <a
            href="/setup/chaves"
            className="flex flex-col items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl px-4 py-4 text-gray-400 hover:text-white transition-colors"
          >
            <Key size={20} />
            <span className="text-xs font-medium">Chaves de Acesso</span>
          </a>
        </div>

        <form onSubmit={handleSalvar} className="space-y-6">
          {/* Supabase */}
          <div className="bg-white rounded-2xl p-6 shadow-xl">
            <h2 className="font-semibold text-gray-900 text-base mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">1</span>
              Supabase
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">URL do projeto</label>
                <input
                  type="url"
                  required
                  value={form.supabaseUrl}
                  onChange={(e) => handleChange('supabaseUrl', e.target.value)}
                  placeholder="https://xxxx.supabase.co"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Anon Key</label>
                <div className="relative">
                  <input
                    type={mostrarKey ? 'text' : 'password'}
                    required
                    value={form.supabaseAnonKey}
                    onChange={(e) => handleChange('supabaseAnonKey', e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                  />
                  <button type="button" onClick={() => setMostrarKey(!mostrarKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {mostrarKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Supabase Dashboard → Project Settings → API</p>
              </div>
            </div>
          </div>

          {/* OpenAI */}
          <div className="bg-white rounded-2xl p-6 shadow-xl">
            <h2 className="font-semibold text-gray-900 text-base mb-1 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">2</span>
              OpenAI <span className="text-xs font-normal text-gray-400 ml-1">(opcional)</span>
            </h2>
            <p className="text-xs text-gray-400 mb-4 ml-8">Necessário para gerar a base de conhecimento do agente</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">API Key</label>
              <div className="relative">
                <input
                  type={mostrarOpenai ? 'text' : 'password'}
                  value={form.openaiKey}
                  onChange={(e) => handleChange('openaiKey', e.target.value)}
                  onFocus={() => { if (form.openaiKey === MASKED) handleChange('openaiKey', '') }}
                  placeholder="sk-..."
                  className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                />
                <button type="button" onClick={() => setMostrarOpenai(!mostrarOpenai)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {mostrarOpenai ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">platform.openai.com → API Keys</p>
            </div>
          </div>

          {/* UAZAPI */}
          <div className="bg-white rounded-2xl p-6 shadow-xl">
            <h2 className="font-semibold text-gray-900 text-base mb-1 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">3</span>
              UAZAPI <span className="text-xs font-normal text-gray-400 ml-1">(opcional)</span>
            </h2>
            <p className="text-xs text-gray-400 mb-4 ml-8">Necessário para envio de mensagens</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">URL base do servidor</label>
                <input
                  type="url"
                  value={form.uazapiUrl}
                  onChange={(e) => handleChange('uazapiUrl', e.target.value)}
                  placeholder="https://seu-servidor.uazapi.com"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                />
                <p className="text-xs text-gray-400 mt-1">URL raiz do servidor UAZAPI (sem /send/text no final)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Token admin</label>
                <div className="relative">
                  <input
                    type={mostrarToken ? 'text' : 'password'}
                    value={form.uazapiToken}
                    onChange={(e) => handleChange('uazapiToken', e.target.value)}
                    onFocus={() => { if (form.uazapiToken === MASKED) handleChange('uazapiToken', '') }}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                  />
                  <button type="button" onClick={() => setMostrarToken(!mostrarToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {mostrarToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Token global do servidor — usado para criar instâncias. Painel UAZAPI → Configurações → Token admin</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleTestarUazapi}
                disabled={testandoUazapi}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 hover:border-gray-400 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
              >
                {testandoUazapi ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
                Testar conexão
              </button>
              {uazapiTesteResult && (
                <span className={`flex items-center gap-1.5 text-xs font-medium ${uazapiTesteResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                  {uazapiTesteResult.ok ? <Wifi size={13} /> : <WifiOff size={13} />}
                  {uazapiTesteResult.msg}
                </span>
              )}
            </div>
          </div>

          {/* Plano / Instâncias */}
          <div className="bg-white rounded-2xl p-6 shadow-xl">
            <h2 className="font-semibold text-gray-900 text-base mb-1 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">4</span>
              Plano — Instâncias WhatsApp
            </h2>
            <p className="text-xs text-gray-400 mb-4 ml-8">Quantidade máxima de números que podem ser conectados neste sistema</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Instâncias permitidas</label>
              <input
                type="number"
                min={1}
                max={100}
                value={form.instanciasPermitidas}
                onChange={(e) => handleChange('instanciasPermitidas', e.target.value)}
                className="w-32 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              />
              <p className="text-xs text-gray-400 mt-1">O cliente só poderá adicionar até esta quantidade de instâncias na aba Conexão</p>
            </div>
          </div>

          {/* Facebook Conversions API */}
          <div className="bg-white rounded-2xl p-6 shadow-xl">
            <h2 className="font-semibold text-gray-900 text-base mb-1 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">5</span>
              Facebook Conversions API <span className="text-xs font-normal text-gray-400 ml-1">(opcional)</span>
            </h2>
            <p className="text-xs text-gray-400 mb-4 ml-8">Envia eventos de conversão ao mover clientes pelo Kanban</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pixel ID</label>
                <input
                  type="text"
                  value={form.fbPixelId}
                  onChange={(e) => handleChange('fbPixelId', e.target.value)}
                  placeholder="123456789012345"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                />
                <p className="text-xs text-gray-400 mt-1">Events Manager → Pixel → Configurações</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Access Token</label>
                <div className="relative">
                  <input
                    type={mostrarFbToken ? 'text' : 'password'}
                    value={form.fbAccessToken}
                    onChange={(e) => handleChange('fbAccessToken', e.target.value)}
                    onFocus={() => { if (form.fbAccessToken === MASKED) handleChange('fbAccessToken', '') }}
                    placeholder="EAAxxxxxxxx..."
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                  />
                  <button type="button" onClick={() => setMostrarFbToken(!mostrarFbToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {mostrarFbToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Events Manager → Pixel → Configurações → API de Conversões</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Código de evento de teste <span className="font-normal text-gray-400">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={form.fbTestEventCode}
                  onChange={(e) => handleChange('fbTestEventCode', e.target.value)}
                  placeholder="TEST12345"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                />
                <p className="text-xs text-gray-400 mt-1">Use durante testes para visualizar eventos no painel do Facebook</p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleTestarFb}
                  disabled={testandoFb}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-50 hover:bg-blue-100 disabled:opacity-60 disabled:cursor-not-allowed text-blue-700 rounded-lg transition-colors border border-blue-200"
                >
                  {testandoFb ? <><Loader2 size={14} className="animate-spin" /> Testando...</> : 'Testar conexão com Facebook'}
                </button>
                {fbTesteResult && (
                  <p className={`text-xs mt-2 font-medium ${fbTesteResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                    {fbTesteResult.ok ? '✓ ' : '✗ '}{fbTesteResult.msg}
                  </p>
                )}
              </div>

              <hr className="border-gray-100" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Marketing API — Dashboard de Ads</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ID da conta de anúncios</label>
                <input
                  type="text"
                  value={form.fbAdAccountId}
                  onChange={(e) => handleChange('fbAdAccountId', e.target.value)}
                  placeholder="act_907365004373512"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                />
                <p className="text-xs text-gray-400 mt-1">Gerenciador de Anúncios → URL da conta</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Token de Ads <span className="font-normal text-gray-400">(com permissão ads_read)</span></label>
                <div className="relative">
                  <input
                    type={mostrarFbAdsToken ? 'text' : 'password'}
                    value={form.fbAdsToken}
                    onChange={(e) => handleChange('fbAdsToken', e.target.value)}
                    onFocus={() => { if (form.fbAdsToken === MASKED) handleChange('fbAdsToken', '') }}
                    placeholder="EAAbi47F8h7g..."
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                  />
                  <button type="button" onClick={() => setMostrarFbAdsToken(!mostrarFbAdsToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {mostrarFbAdsToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Explorador da Graph API com permissão ads_read</p>
              </div>
            </div>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {erro}
            </div>
          )}

          {sucesso && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
              <CheckCircle size={16} />
              Configurações salvas com sucesso!
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={salvando}
              className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {salvando ? <><Loader2 size={18} className="animate-spin" /> Salvando...</> : 'Salvar configurações'}
            </button>

            {sucesso && (
              <button
                type="button"
                onClick={handleIrParaApp}
                className="flex-1 bg-gray-900 hover:bg-gray-800 text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                Ir para o sistema →
              </button>
            )}
          </div>

        </form>

        {/* Template Global de Prompt */}
        <div className="mt-6 bg-white rounded-2xl p-6 shadow-xl space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900 text-base flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700">6</span>
              Template de Prompt Global
            </h2>
            <p className="text-xs text-gray-400 mt-1 ml-8">
              Define como o agente de TODOS os usuários recebe os dados de treinamento. Arraste ou clique nos blocos para inserir no template.
            </p>
          </div>

          {/* Chips arrastáveis */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Prompt do agente', value: '{{prompt}}', color: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' },
              { label: 'Perguntas & Respostas', value: '{{qa}}', color: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' },
              { label: 'Textos', value: '{{textos}}', color: 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200' },
            ].map((bloco) => (
              <div
                key={bloco.value}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', bloco.value)}
                onClick={() => inserirBloco(bloco.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium cursor-grab active:cursor-grabbing select-none transition-colors ${bloco.color}`}
                title={`Clique ou arraste para inserir ${bloco.value}`}
              >
                <GripVertical size={13} className="opacity-50" />
                {bloco.label}
                <code className="text-xs opacity-60 font-mono">{bloco.value}</code>
              </div>
            ))}
          </div>

          <textarea
            ref={templateRef}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={12}
            placeholder={`Ex:\nVocê é um assistente de vendas. Siga as instruções abaixo:\n\n{{prompt}}\n\nUse as perguntas e respostas frequentes como referência:\n\n{{qa}}\n\nInformações adicionais da empresa:\n\n{{textos}}`}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none font-mono"
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={salvarTemplate}
              disabled={salvandoTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {salvandoTemplate ? <Loader2 size={15} className="animate-spin" /> : null}
              Salvar template
            </button>
            {templateSalvo && (
              <span className="flex items-center gap-1 text-green-600 text-sm">
                <CheckCircle size={14} /> Salvo!
              </span>
            )}
            {!template.trim() && (
              <span className="text-xs text-amber-600">
                Sem template → o agente usa a base de conhecimento gerada ou o prompt direto.
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
