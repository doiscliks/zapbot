'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Save, Calendar, Link2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'

const DIAS = [
  { label: 'Dom', value: 0 }, { label: 'Seg', value: 1 }, { label: 'Ter', value: 2 },
  { label: 'Qua', value: 3 }, { label: 'Qui', value: 4 }, { label: 'Sex', value: 5 }, { label: 'Sáb', value: 6 },
]

const cardStyle = { backgroundColor: '#fff', border: '1px solid #E9EEF2', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', borderRadius: '1rem' }
const inputClass = 'w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white'
const inputStyle = { borderColor: '#E9EEF2', '--tw-ring-color': '#12C6D6' } as React.CSSProperties

export default function AgendaConfigPage() {
  const searchParams = useSearchParams()
  const googleStatus = searchParams.get('google')

  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [googleConectado, setGoogleConectado] = useState(false)
  const [appUrl, setAppUrl] = useState('')

  const [form, setForm] = useState({
    titulo: '2Cliks Contabilidade — Agendar Reunião',
    slug: '2cliks',
    descricao: '',
    duracao_minutos: 60,
    dias_semana: [1, 2, 3, 4, 5],
    hora_inicio: '09:00',
    hora_fim: '18:00',
    antecedencia_minima_horas: 24,
    dias_antecedencia_maxima: 30,
    ativo: true,
  })

  useEffect(() => {
    setAppUrl(window.location.origin)
    fetch('/api/agenda/config')
      .then(r => r.json())
      .then(data => {
        if (data) {
          setForm(f => ({ ...f, ...data }))
          setGoogleConectado(!!data.google_conectado)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  function toggleDia(dia: number) {
    setForm(f => ({
      ...f,
      dias_semana: f.dias_semana.includes(dia)
        ? f.dias_semana.filter(d => d !== dia)
        : [...f.dias_semana, dia].sort(),
    }))
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    setSucesso(false)

    const res = await fetch('/api/agenda/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()

    if (!res.ok) { setErro(data.error ?? 'Erro ao salvar'); setSalvando(false); return }
    setSucesso(true)
    setForm(f => ({ ...f, ...data }))
    setSalvando(false)
  }

  const linkPublico = `${appUrl}/agendar/${form.slug}`

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 size={24} className="animate-spin" style={{ color: '#12C6D6' }} />
    </div>
  )

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-7">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#1F2937' }}>Configurar Agenda</h1>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Configure seus horários e conecte o Google Calendar.</p>
      </div>

      {googleStatus === 'ok' && (
        <div className="flex items-center gap-2 text-sm px-4 py-3 rounded-xl mb-5" style={{ backgroundColor: '#E8F9FB', color: '#0FBDCC', border: '1px solid rgba(18,198,214,0.25)' }}>
          <CheckCircle size={15} /> Google Calendar conectado com sucesso!
        </div>
      )}
      {googleStatus === 'erro' && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl mb-5">
          <AlertCircle size={15} /> Erro ao conectar o Google. Tente novamente.
        </div>
      )}

      <form onSubmit={handleSalvar} className="space-y-5">
        {/* Link público */}
        <div className="p-5" style={cardStyle}>
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={16} style={{ color: '#12C6D6' }} />
            <h2 className="font-semibold text-sm" style={{ color: '#1F2937' }}>Link de agendamento</h2>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-mono" style={{ backgroundColor: '#F0FAFB', border: '1px solid rgba(18,198,214,0.2)', color: '#0FBDCC' }}>
            <span className="flex-1 truncate">{linkPublico}</span>
            <a href={linkPublico} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} style={{ color: '#12C6D6' }} />
            </a>
          </div>
          <div className="mt-3">
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#6B7280' }}>Slug (parte final do link)</label>
            <input
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
              placeholder="ex: 2cliks"
              className={inputClass} style={inputStyle}
            />
          </div>
        </div>

        {/* Informações */}
        <div className="p-5" style={cardStyle}>
          <h2 className="font-semibold text-sm mb-4" style={{ color: '#1F2937' }}>Informações da página</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#6B7280' }}>Título</label>
              <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#6B7280' }}>Descrição (opcional)</label>
              <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} className={`${inputClass} resize-none`} style={inputStyle} placeholder="Ex: Reunião de consultoria contábil gratuita" />
            </div>
          </div>
        </div>

        {/* Disponibilidade */}
        <div className="p-5" style={cardStyle}>
          <h2 className="font-semibold text-sm mb-4" style={{ color: '#1F2937' }}>Disponibilidade</h2>
          <div className="space-y-4">
            {/* Dias da semana */}
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#6B7280' }}>Dias disponíveis</label>
              <div className="flex gap-2 flex-wrap">
                {DIAS.map(d => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDia(d.value)}
                    className="w-12 h-10 rounded-xl text-sm font-semibold transition-all"
                    style={form.dias_semana.includes(d.value)
                      ? { background: 'linear-gradient(135deg, #12C6D6, #0FBDCC)', color: 'white', boxShadow: '0 2px 8px rgba(18,198,214,0.3)' }
                      : { backgroundColor: '#F8FAFC', color: '#6B7280', border: '1px solid #E9EEF2' }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Horários */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#6B7280' }}>Início</label>
                <input type="time" value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#6B7280' }}>Fim</label>
                <input type="time" value={form.hora_fim} onChange={e => setForm(f => ({ ...f, hora_fim: e.target.value }))} className={inputClass} style={inputStyle} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#6B7280' }}>Duração (min)</label>
                <input type="number" min={15} max={480} step={15} value={form.duracao_minutos} onChange={e => setForm(f => ({ ...f, duracao_minutos: Number(e.target.value) }))} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#6B7280' }}>Antecedência mín. (h)</label>
                <input type="number" min={0} max={168} value={form.antecedencia_minima_horas} onChange={e => setForm(f => ({ ...f, antecedencia_minima_horas: Number(e.target.value) }))} className={inputClass} style={inputStyle} />
              </div>
            </div>
          </div>
        </div>

        {/* Google Calendar */}
        <div className="p-5" style={cardStyle}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={16} style={{ color: '#12C6D6' }} />
              <div>
                <h2 className="font-semibold text-sm" style={{ color: '#1F2937' }}>Google Calendar + Meet</h2>
                <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                  {googleConectado ? 'Conectado — eventos e Meet gerados automaticamente' : 'Não conectado'}
                </p>
              </div>
            </div>
            <a
              href="/api/agenda/google/auth"
              className="px-4 py-2 text-sm font-semibold rounded-xl text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #12C6D6, #0FBDCC)', boxShadow: '0 2px 8px rgba(18,198,214,0.3)' }}
            >
              {googleConectado ? 'Reconectar' : 'Conectar Google'}
            </a>
          </div>
        </div>

        {erro && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
            <AlertCircle size={14} /> {erro}
          </div>
        )}
        {sucesso && (
          <div className="flex items-center gap-2 text-sm px-4 py-3 rounded-xl" style={{ backgroundColor: '#E8F9FB', color: '#0FBDCC', border: '1px solid rgba(18,198,214,0.25)' }}>
            <CheckCircle size={14} /> Configurações salvas!
          </div>
        )}

        <button
          type="submit"
          disabled={salvando}
          className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-xl disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #12C6D6, #0FBDCC)', boxShadow: '0 4px 14px rgba(18,198,214,0.3)' }}
        >
          {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {salvando ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </form>
    </div>
  )
}
