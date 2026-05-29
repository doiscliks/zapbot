'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Calendar, Settings, CheckCircle, XCircle, Clock, Video, ExternalLink, Trash2 } from 'lucide-react'

interface Agendamento {
  id: string
  nome: string
  telefone: string
  email: string | null
  assunto: string | null
  data_hora: string
  duracao_minutos: number
  status: 'confirmado' | 'cancelado' | 'realizado'
  meet_link: string | null
  whatsapp_enviado: boolean
  created_at: string
}

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  confirmado: { label: 'Confirmado', bg: '#E8F9FB', color: '#0FBDCC' },
  realizado:  { label: 'Realizado',  bg: '#F0FDF4', color: '#16a34a' },
  cancelado:  { label: 'Cancelado',  bg: '#FEF2F2', color: '#dc2626' },
}

function formatDataHora(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
}

export default function AgendaPage() {
  const router = useRouter()
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'proximos' | 'todos' | 'cancelados'>('proximos')

  useEffect(() => {
    fetch('/api/agenda/agendamentos')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAgendamentos(data) })
      .finally(() => setLoading(false))
  }, [])

  async function alterarStatus(id: string, status: string) {
    await fetch(`/api/agenda/agendamentos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status: status as Agendamento['status'] } : a))
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este agendamento?')) return
    await fetch(`/api/agenda/agendamentos/${id}`, { method: 'DELETE' })
    setAgendamentos(prev => prev.filter(a => a.id !== id))
  }

  const agora = new Date()
  const filtrados = agendamentos.filter(a => {
    if (filtro === 'proximos') return a.status === 'confirmado' && new Date(a.data_hora) >= agora
    if (filtro === 'cancelados') return a.status === 'cancelado'
    return true
  })

  const cardStyle = { backgroundColor: '#fff', border: '1px solid #E9EEF2', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-start justify-between mb-7 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: '#1F2937' }}>
            <Calendar size={22} style={{ color: '#12C6D6' }} /> Agenda
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>{agendamentos.filter(a => a.status === 'confirmado').length} agendamentos confirmados</p>
        </div>
        <button
          onClick={() => router.push('/agenda/config')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #12C6D6, #0FBDCC)', boxShadow: '0 2px 8px rgba(18,198,214,0.3)' }}
        >
          <Settings size={15} /> Configurar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ backgroundColor: '#F0FAFB' }}>
        {([['proximos', 'Próximos'], ['todos', 'Todos'], ['cancelados', 'Cancelados']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFiltro(val)}
            className="px-4 py-2 text-sm font-semibold rounded-lg transition-all"
            style={filtro === val
              ? { background: 'linear-gradient(135deg, #12C6D6, #0FBDCC)', color: 'white', boxShadow: '0 2px 8px rgba(18,198,214,0.3)' }
              : { color: '#6B7280' }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-3" style={{ color: '#12C6D6' }}>
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm" style={{ color: '#6B7280' }}>Carregando...</span>
        </div>
      )}

      {!loading && filtrados.length === 0 && (
        <div className="text-center py-16 rounded-2xl" style={cardStyle}>
          <Calendar size={40} className="mx-auto mb-3" style={{ color: '#D1D5DB' }} />
          <p className="font-medium" style={{ color: '#6B7280' }}>Nenhum agendamento encontrado</p>
          <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>Compartilhe o link da agenda com seus clientes</p>
        </div>
      )}

      <div className="space-y-3">
        {filtrados.map(ag => {
          const st = STATUS_STYLE[ag.status] ?? STATUS_STYLE.confirmado
          const isFuturo = new Date(ag.data_hora) >= agora
          return (
            <div key={ag.id} className="rounded-2xl p-5" style={cardStyle}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold" style={{ color: '#1F2937' }}>{ag.nome}</p>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                    {ag.whatsapp_enviado && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F0FDF4', color: '#16a34a' }}>
                        WhatsApp ✓
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-sm mb-1" style={{ color: '#6B7280' }}>
                    <Clock size={13} />
                    <span>{formatDataHora(ag.data_hora)} — {ag.duracao_minutos}min</span>
                  </div>

                  <div className="text-sm" style={{ color: '#6B7280' }}>
                    📞 {ag.telefone}
                    {ag.email && <span className="ml-3">✉️ {ag.email}</span>}
                  </div>

                  {ag.assunto && (
                    <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>📋 {ag.assunto}</p>
                  )}

                  {ag.meet_link && (
                    <a href={ag.meet_link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium"
                      style={{ color: '#12C6D6' }}>
                      <Video size={14} /> Abrir Google Meet <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {ag.status === 'confirmado' && isFuturo && (
                    <button
                      onClick={() => alterarStatus(ag.id, 'realizado')}
                      title="Marcar como realizado"
                      className="p-2 rounded-lg transition-colors hover:bg-green-50"
                      style={{ color: '#9CA3AF' }}
                    >
                      <CheckCircle size={16} />
                    </button>
                  )}
                  {ag.status === 'confirmado' && (
                    <button
                      onClick={() => alterarStatus(ag.id, 'cancelado')}
                      title="Cancelar"
                      className="p-2 rounded-lg transition-colors hover:bg-red-50"
                      style={{ color: '#9CA3AF' }}
                    >
                      <XCircle size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => excluir(ag.id)}
                    title="Excluir"
                    className="p-2 rounded-lg transition-colors hover:bg-red-50 hover:text-red-500"
                    style={{ color: '#9CA3AF' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
