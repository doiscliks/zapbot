'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, CheckCircle, Video } from 'lucide-react'

interface Config {
  titulo: string
  descricao: string | null
  duracao_minutos: number
  ativo: boolean
}

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>()
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/agenda/publica?slug=${slug}`)
      .then(r => r.json())
      .then(data => setConfig(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8FAFC' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--brand-primary)' }} />
      </div>
    )
  }

  if (!config || !config.ativo) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8FAFC' }}>
        <div className="text-center">
          <p className="text-lg font-semibold" style={{ color: '#1F2937' }}>Agenda não encontrada</p>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Este link não está disponível.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F8FAFC' }}>
      <div className="text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: 'var(--brand-gradient)', boxShadow: 'var(--brand-shadow-lg)' }}>
          <CheckCircle size={38} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: '#1F2937' }}>{config.titulo}</h1>
        <p className="text-sm mb-6" style={{ color: '#6B7280' }}>Duração: {config.duracao_minutos} minutos</p>
        {config.descricao && (
          <p className="text-sm mb-6" style={{ color: '#6B7280' }}>{config.descricao}</p>
        )}
        <p className="text-sm" style={{ color: '#9CA3AF' }}>Este é um link de agendamento público.</p>
      </div>
    </div>
  )
}
