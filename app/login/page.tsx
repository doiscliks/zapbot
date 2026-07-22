'use client'

import { useState } from 'react'
import { Loader2, Mail, Lock, Key, AlertCircle, User, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase-client'
import { brand } from '@/lib/brand'

type Step = 'auth' | 'chave'

const inputClass =
  'w-full pl-10 pr-4 py-3 border rounded-xl text-sm text-gray-800 placeholder-gray-400 bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:border-transparent'
const inputStyle = {
  borderColor: 'var(--brand-border)',
  '--tw-ring-color': 'var(--brand-primary)',
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
      className="min-h-screen flex items-center justify-center px-4 relative"
      style={{ background: 'linear-gradient(145deg, #E8F9FB 0%, #F8FAFC 45%, #EEF4FF 100%)' }}
    >
      {/* Camada decorativa — overflow-hidden isolado aqui, fora do formulário.
          (overflow-hidden num ancestral do form trava o foco de inputs no PWA iOS standalone) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        {/* Caractere decorativo de fundo */}
        <span
          className="absolute select-none font-black"
          style={{
            fontSize: 'clamp(200px, 45vw, 600px)',
            color: 'var(--brand-primary)',
            opacity: 0.04,
            top: '-8%',
            right: '-5%',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          {brand.logoChar}
        </span>

        <div
          className="absolute rounded-full"
          style={{
            width: 300,
            height: 300,
            background: 'radial-gradient(circle, var(--brand-ring-08) 0%, transparent 70%)',
            bottom: '-60px',
            left: '-60px',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 200,
            height: 200,
            background: 'radial-gradient(circle, var(--brand-ring-07) 0%, transparent 70%)',
            top: '10%',
            left: '8%',
          }}
        />
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm relative animate-fade-in-up"
        style={{ zIndex: 1 }}
      >
        <div
          className="bg-white rounded-3xl p-8"
          style={{
            boxShadow: 'var(--brand-glow)',
            border: 'var(--brand-border-card)',
          }}
        >
          {/* Brand header */}
          <div className="flex flex-col items-center mb-7">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl mb-4"
              style={{
                background: 'var(--brand-gradient)',
                boxShadow: 'var(--brand-shadow-lg)',
              }}
            >
              {brand.logoChar}
            </div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#1F2937' }}>
              {brand.shortName}
            </h1>
            <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--brand-primary)' }}>
              {step === 'chave' ? 'Insira sua chave de acesso' : brand.tagline}
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
                  <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                    <User size={15} style={{ color: '#9CA3AF' }} />
                  </span>
                  <input
                    type="text"
                    required
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
                  <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                    <Key size={15} style={{ color: '#9CA3AF' }} />
                  </span>
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
                style={{ background: 'var(--brand-gradient)', boxShadow: 'var(--brand-shadow)' }}
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
                  <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                    <Mail size={15} style={{ color: '#9CA3AF' }} />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className={inputClass}
                    style={{ ...inputStyle, paddingLeft: '2.25rem' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#6B7280' }}>
                  Senha
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                    <Lock size={15} style={{ color: '#9CA3AF' }} />
                  </span>
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
                  background: 'var(--brand-gradient)',
                  boxShadow: 'var(--brand-shadow)',
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
          © {new Date().getFullYear()} {brand.name} · Todos os direitos reservados
        </p>
      </div>
    </div>
  )
}
