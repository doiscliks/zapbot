'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Save, Calendar, Link2, CheckCircle, AlertCircle, ExternalLink, Smartphone, XCircle, Bell, Plus, Trash2 } from 'lucide-react'

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
  const googleMsg = searchParams.get('msg')

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
    periodos: [{ inicio: '09:00', fim: '18:00' }] as { inicio: string; fim: string }[],
    ativo: true,
    whatsapp_instancia_id: '',
    mensagem_cancelamento: 'Olá, {nome}! Seu agendamento do dia {data} às {hora} foi cancelado. Entre em contato para remarcar.',
    lembrete_antecedencia_horas: 0,
  })
  const [instancias, setInstancias] = useState<{ id: string; nome: string }[]>([])

  useEffect(() => {
    setAppUrl(window.location.origin)
    fetch('/api/instancias')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setInstancias(data) })
      .catch(() => {})
    fetch('/api/agenda/config')
      .then(r => r.json())
      .then(data => {
        if (data) {
          setForm(f => ({ ...f, ...data }))
          setGoogleConectado(!!data.google_conectado)
        }
        // Se veio de um OAuth bem-sucedido, força o estado mesmo que a API ainda não reflita
        if (googleStatus === 'ok') setGoogleConectado(true)
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <AlertCircle size={15} /> Erro ao conectar o Google{googleMsg ? `: ${googleMsg}` : '. Tente novamente.'}
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

            {/* Períodos de horário */}
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#6B7280' }}>Horários disponíveis</label>
              <div className="space-y-2">
                {form.periodos.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={p.inicio}
                      onChange={e => {
                        const next = [...form.periodos]
                        next[i] = { ...next[i], inicio: e.target.value }
                        setForm(f => ({ ...f, periodos: next }))
                      }}
                      className="flex-1 px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white"
                      style={inputStyle}
                    />
                    <span className="text-sm font-medium" style={{ color: '#9CA3AF' }}>às</span>
                    <input
                      type="time"
                      value={p.fim}
                      onChange={e => {
                        const next = [...form.periodos]
                        next[i] = { ...next[i], fim: e.target.value }
                        setForm(f => ({ ...f, periodos: next }))
                      }}
                      className="flex-1 px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white"
                      style={inputStyle}
                    />
                    {form.periodos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, periodos: f.periodos.filter((_, j) => j !== i) }))}
                        className="p-2 rounded-lg transition-colors hover:bg-red-50 hover:text-red-500 shrink-0"
                        style={{ color: '#9CA3AF' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, periodos: [...f.periodos, { inicio: '14:00', fim: '18:00' }] }))}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold transition-colors"
                style={{ color: '#12C6D6' }}
              >
                <Plus size={14} /> Adicionar período
              </button>
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

        {/* WhatsApp */}
        <div className="p-5" style={cardStyle}>
          <div className="flex items-center gap-2 mb-3">
            <Smartphone size={16} style={{ color: '#12C6D6' }} />
            <h2 className="font-semibold text-sm" style={{ color: '#1F2937' }}>Confirmação via WhatsApp</h2>
          </div>
          <p className="text-xs mb-3" style={{ color: '#6B7280' }}>Instância que enviará a mensagem de confirmação ao cliente após o agendamento.</p>
          <select
            value={form.whatsapp_instancia_id}
            onChange={e => setForm(f => ({ ...f, whatsapp_instancia_id: e.target.value }))}
            className={inputClass} style={inputStyle}
          >
            <option value="">Não enviar WhatsApp</option>
            {instancias.map(i => (
              <option key={i.id} value={i.id}>{i.nome}</option>
            ))}
          </select>
          <p className="text-xs mt-3" style={{ color: '#9CA3AF' }}>
            Quando alguém agendar, a mesma mensagem de confirmação também é enviada ao seu WhatsApp cadastrado em <strong>Usuários</strong>.
          </p>
        </div>

        {/* Mensagem de cancelamento */}
        <div className="p-5" style={cardStyle}>
          <div className="flex items-center gap-2 mb-3">
            <XCircle size={16} style={{ color: '#FF7A66' }} />
            <h2 className="font-semibold text-sm" style={{ color: '#1F2937' }}>Mensagem de cancelamento</h2>
          </div>
          <p className="text-xs mb-3" style={{ color: '#6B7280' }}>
            Enviada ao cliente via WhatsApp quando o agendamento for cancelado. O evento também será removido do Google Calendar.
          </p>
          <textarea
            rows={3}
            value={form.mensagem_cancelamento}
            onChange={e => setForm(f => ({ ...f, mensagem_cancelamento: e.target.value }))}
            className={`${inputClass} resize-none`} style={inputStyle}
          />
          <p className="text-xs mt-1.5" style={{ color: '#9CA3AF' }}>
            Variáveis disponíveis: <code className="bg-gray-100 px-1 rounded">{'{nome}'}</code> <code className="bg-gray-100 px-1 rounded">{'{data}'}</code> <code className="bg-gray-100 px-1 rounded">{'{hora}'}</code>
          </p>
        </div>

        {/* Lembrete antecedência */}
        <div className="p-5" style={cardStyle}>
          <div className="flex items-center gap-2 mb-3">
            <Bell size={16} style={{ color: '#12C6D6' }} />
            <h2 className="font-semibold text-sm" style={{ color: '#1F2937' }}>Lembrete automático via WhatsApp</h2>
          </div>
          <p className="text-xs mb-3" style={{ color: '#6B7280' }}>
            Envia uma mensagem de lembrete ao cliente antes da reunião. Selecione 0 para desativar.
          </p>
          <select
            value={form.lembrete_antecedencia_horas}
            onChange={e => setForm(f => ({ ...f, lembrete_antecedencia_horas: Number(e.target.value) }))}
            className={inputClass} style={inputStyle}
          >
            <option value={0}>Não enviar lembrete</option>
            <option value={1}>1 hora antes</option>
            <option value={2}>2 horas antes</option>
            <option value={6}>6 horas antes</option>
            <option value={12}>12 horas antes</option>
            <option value={24}>24 horas antes (1 dia)</option>
            <option value={48}>48 horas antes (2 dias)</option>
          </select>
          {form.lembrete_antecedencia_horas > 0 && (
            <p className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F0FAFB', color: '#12C6D6' }}>
              ✓ O cliente receberá um lembrete {form.lembrete_antecedencia_horas}h antes da reunião com o link do Google Meet.
            </p>
          )}
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
