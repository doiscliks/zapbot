'use client'

import { useEffect, useState } from 'react'
import { Settings, Loader2, CheckCircle, Eye, EyeOff, AlertCircle } from 'lucide-react'

const MASKED = '••••••••••••••••••••••'

interface ConfigForm {
  telefone: string
  openaiKey: string
  fbPixelId: string
  fbAccessToken: string
  fbTestEventCode: string
  fbAdsToken: string
  fbAdAccountId: string
}

export default function ConfiguracoesPage() {
  const [form, setForm] = useState<ConfigForm>({
    telefone: '',
    openaiKey: '',
    fbPixelId: '',
    fbAccessToken: '',
    fbTestEventCode: '',
    fbAdsToken: '',
    fbAdAccountId: '',
  })
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mostrarOpenai, setMostrarOpenai] = useState(false)
  const [mostrarFbToken, setMostrarFbToken] = useState(false)
  const [mostrarFbAdsToken, setMostrarFbAdsToken] = useState(false)

  useEffect(() => {
    fetch('/api/config/usuario')
      .then((r) => r.json())
      .then((data) => {
        setForm({
          telefone: data.telefone || '',
          openaiKey: data.hasOpenaiKey ? MASKED : '',
          fbPixelId: data.fbPixelId || '',
          fbAccessToken: data.hasFbAccessToken ? MASKED : '',
          fbTestEventCode: data.fbTestEventCode || '',
          fbAdsToken: data.hasFbAdsToken ? MASKED : '',
          fbAdAccountId: data.fbAdAccountId || '',
        })
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

    const res = await fetch('/api/config/usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setErro(data.error ?? 'Erro ao salvar configurações.')
      setSalvando(false)
      return
    }

    setSucesso(true)
    setSalvando(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500 text-sm mt-1">Configure as integrações da sua conta.</p>
      </div>

      <form onSubmit={handleSalvar} className="space-y-6">
        {/* Perfil */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-900">Seu perfil</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Telefone usado para receber notificações (ex: relatório de Ads, novos agendamentos).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Seu WhatsApp</label>
            <input
              type="text"
              value={form.telefone}
              onChange={(e) => handleChange('telefone', e.target.value)}
              placeholder="Ex: 5511999998888"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#12C6D6] focus:border-transparent transition"
            />
          </div>
        </div>

        {/* OpenAI */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-900">OpenAI</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Necessário para o agente de IA responder mensagens e gerar base de conhecimento.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              API Key
            </label>
            <div className="relative">
              <input
                type={mostrarOpenai ? 'text' : 'password'}
                value={form.openaiKey}
                onChange={(e) => handleChange('openaiKey', e.target.value)}
                onFocus={() => { if (form.openaiKey === MASKED) handleChange('openaiKey', '') }}
                placeholder="sk-..."
                className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#12C6D6] focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setMostrarOpenai(!mostrarOpenai)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {mostrarOpenai ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              platform.openai.com → API Keys
            </p>
          </div>
        </div>

        {/* Facebook */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-900">
              Facebook Conversions API{' '}
              <span className="text-xs font-normal text-gray-400">(opcional)</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Envia eventos de conversão ao mover clientes pelo Kanban.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Pixel ID</label>
              <input
                type="text"
                value={form.fbPixelId}
                onChange={(e) => handleChange('fbPixelId', e.target.value)}
                placeholder="123456789012345"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#12C6D6] focus:border-transparent transition"
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
                  className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#12C6D6] focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setMostrarFbToken(!mostrarFbToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {mostrarFbToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Events Manager → Pixel → Configurações → API de Conversões
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Código de teste{' '}
                <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={form.fbTestEventCode}
                onChange={(e) => handleChange('fbTestEventCode', e.target.value)}
                placeholder="TEST12345"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#12C6D6] focus:border-transparent transition"
              />
            </div>

            <hr className="border-gray-100" />

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Marketing API — Dashboard de Ads
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                ID da conta de anúncios
              </label>
              <input
                type="text"
                value={form.fbAdAccountId}
                onChange={(e) => handleChange('fbAdAccountId', e.target.value)}
                placeholder="act_907365004373512"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#12C6D6] focus:border-transparent transition"
              />
              <p className="text-xs text-gray-400 mt-1">Gerenciador de Anúncios → URL da conta</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Token de Ads{' '}
                <span className="font-normal text-gray-400">(permissão ads_read)</span>
              </label>
              <div className="relative">
                <input
                  type={mostrarFbAdsToken ? 'text' : 'password'}
                  value={form.fbAdsToken}
                  onChange={(e) => handleChange('fbAdsToken', e.target.value)}
                  onFocus={() => { if (form.fbAdsToken === MASKED) handleChange('fbAdsToken', '') }}
                  placeholder="EAAbi47F8h7g..."
                  className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#12C6D6] focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setMostrarFbAdsToken(!mostrarFbAdsToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {mostrarFbAdsToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Explorador da Graph API com permissão ads_read
              </p>
            </div>
          </div>
        </div>

        {erro && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            <AlertCircle size={15} /> {erro}
          </div>
        )}

        {sucesso && (
          <div className="flex items-center gap-2 text-sm px-4 py-3 rounded-xl" style={{ backgroundColor: '#E8F9FB', borderColor: 'rgba(18,198,214,0.25)', border: '1px solid', color: '#0FBDCC' }}>
            <CheckCircle size={15} /> Configurações salvas com sucesso!
          </div>
        )}

        <button
          type="submit"
          disabled={salvando}
          className="w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-all"
        style={{ background: 'linear-gradient(135deg, #12C6D6 0%, #0FBDCC 100%)', boxShadow: '0 4px 14px rgba(18,198,214,0.3)' }}
        >
          {salvando ? (
            <><Loader2 size={18} className="animate-spin" /> Salvando...</>
          ) : (
            <>
              <Settings size={18} /> Salvar configurações
            </>
          )}
        </button>
      </form>
    </div>
  )
}
