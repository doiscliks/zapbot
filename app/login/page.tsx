'use client'

import { useState } from 'react'
import { Loader2, Mail, Lock, Key, AlertCircle, User, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase-client'

type Step = 'auth' | 'chave'

const inputClass =
  'w-full pl-10 pr-4 py-3 border rounded-xl text-sm text-gray-800 placeholder-gray-400 bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:border-transparent'
const inputStyle = {
  borderColor: '#E9EEF2',
  '--tw-ring-color': '#12C6D6',
} as React.CSSProperties

export default function LoginPage() {
  const [step, setStep] = useState<Step>('auth')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [chave, setChave] = useState('')
  const [nome, setNome] = useState('')
  const [ativando, setAtivando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setLoading(true)

    // Tenta login de sub-usuário (email+senha próprios). Conta de topo cai no Supabase Auth.
    const subRes = await fetch('/api/tenant/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    })
    if (subRes.ok) { window.location.href = '/dashboard'; return }
    if (subRes.status === 403) {
      const d = await subRes.json().catch(() => ({}))
      setErro(d.error ?? 'Acesso negado'); setLoading(false); return
    }
    // 401 = não é sub-usuário → segue para o Supabase Auth normal

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) { setErro('Email ou senha inválidos'); setLoading(false); return }

    const res = await fetch('/api/tenant/sincronizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: data.session.access_token }),
    })

    const sync = await res.json()
    setLoading(false)

    if (!res.ok) { setErro('Erro ao sincronizar sessão'); return }
    if (sync.needsKey) { setStep('chave'); return }

    window.location.href = '/dashboard'
  }

  async function handleAtivarChave(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setAtivando(true)

    const res = await fetch('/api/tenant/ativar-chave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chave, nome: nome.trim() }),
    })
    const data = await res.json()

    if (!res.ok) { setErro(data.error ?? 'Chave inválida'); setAtivando(false); return }
    window.location.href = '/dashboard'
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #E8F9FB 0%, #F8FAFC 45%, #EEF4FF 100%)' }}
    >
      {/* Background decorative "2" */}
      <span
        className="absolute select-none pointer-events-none font-black"
        style={{
          fontSize: 'clamp(200px, 45vw, 600px)',
          color: '#12C6D6',
          opacity: 0.04,
          top: '-8%',
          right: '-5%',
          lineHeight: 1,
          userSelect: 'none',
        }}
        aria-hidden
      >
        2
      </span>

      {/* Decorative circles */}
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          width: 300,
          height: 300,
          background: 'radial-gradient(circle, rgba(18,198,214,0.08) 0%, transparent 70%)',
          bottom: '-60px',
          left: '-60px',
        }}
        aria-hidden
      />
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          width: 200,
          height: 200,
          background: 'radial-gradient(circle, rgba(255,122,102,0.07) 0%, transparent 70%)',
          top: '10%',
          left: '8%',
        }}
        aria-hidden
      />

      {/* Card */}
      <div
        className="w-full max-w-sm relative animate-fade-in-up"
        style={{ zIndex: 1 }}
      >
        <div
          className="bg-white rounded-3xl p-8"
          style={{
            boxShadow: '0 25px 60px rgba(18,198,214,0.1), 0 8px 24px rgba(0,0,0,0.06)',
            border: '1px solid rgba(18,198,214,0.12)',
          }}
        >
          {/* Brand header */}
          <div className="flex flex-col items-center mb-7">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl mb-4"
              style={{
                background: 'linear-gradient(135deg, #12C6D6 0%, #0FBDCC 100%)',
                boxShadow: '0 8px 24px rgba(18,198,214,0.35)',
              }}
            >
              2
            </div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#1F2937' }}>
              2Cliks
            </h1>
            <p className="text-sm font-medium mt-0.5" style={{ color: '#12C6D6' }}>
              {step === 'chave' ? 'Insira sua chave de acesso' : 'Contabilidade Digital Inteligente'}
            </p>
          </div>

          {/* ── Etapa: Chave ── */}
          {step === 'chave' ? (
            <form onSubmit={handleAtivarChave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#6B7280' }}>
                  Seu nome
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
                  <input
                    type="text"
                    required
                    autoFocus
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Como quer ser chamado?"
                    className={inputClass}
                    style={{ ...inputStyle, paddingLeft: '2.25rem' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#6B7280' }}>
                  Chave de acesso
                </label>
                <div className="relative">
                  <Key size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
                  <input
                    type="text"
                    required
                    value={chave}
                    onChange={(e) => setChave(e.target.value.toUpperCase())}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    className={`${inputClass} font-mono tracking-wider`}
                    style={{ ...inputStyle, paddingLeft: '2.25rem' }}
                  />
                </div>
              </div>

              {erro && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
                  <AlertCircle size={14} className="shrink-0" /> {erro}
                </div>
              )}

              <button
                type="submit"
                disabled={ativando}
                className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-xl transition-all duration-150 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #12C6D6 0%, #0FBDCC 100%)', boxShadow: '0 4px 14px rgba(18,198,214,0.35)' }}
              >
                {ativando ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {ativando ? 'Verificando...' : 'Ativar chave'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('auth'); setErro(null); setChave('') }}
                className="w-full text-sm py-1 transition-colors"
                style={{ color: '#9CA3AF' }}
              >
                ← Voltar ao login
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#6B7280' }}>
                      Email
                    </label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className={inputClass}
                        style={{ ...inputStyle, paddingLeft: '2.25rem' }}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#6B7280' }}>
                      Senha
                    </label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
                      <input
                        type="password"
                        required
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        placeholder="••••••••"
                        className={inputClass}
                        style={{ ...inputStyle, paddingLeft: '2.25rem' }}
                      />
                    </div>
                  </div>

                  {erro && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
                      <AlertCircle size={14} className="shrink-0" /> {erro}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-xl transition-all duration-150 disabled:opacity-60 mt-2"
                    style={{
                      background: 'linear-gradient(135deg, #12C6D6 0%, #0FBDCC 100%)',
                      boxShadow: '0 4px 14px rgba(18,198,214,0.35)',
                    }}
                  >
                    {loading ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <ArrowRight size={17} />
                    )}
                    {loading ? 'Aguarde...' : 'Entrar na plataforma'}
                  </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-5" style={{ color: '#9CA3AF' }}>
          © {new Date().getFullYear()} 2Cliks Contabilidade · Todos os direitos reservados
        </p>
      </div>
    </div>
  )
}
