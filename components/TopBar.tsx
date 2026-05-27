'use client'

import { useEffect, useState } from 'react'
import { Bell, ChevronDown } from 'lucide-react'

function getInitials(nome: string) {
  const parts = nome.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return nome.trim().slice(0, 2).toUpperCase()
}

export default function TopBar() {
  const [nome, setNome] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/tenant/me')
      .then((r) => r.json())
      .then((d) => { if (d.nome || d.email) setNome(d.nome || d.email) })
      .catch(() => {})
  }, [])

  if (!nome) return null

  const initials = getInitials(nome)

  return (
    <div
      className="hidden md:flex fixed top-0 right-0 z-30 items-center gap-2 px-5 bg-white border-b"
      style={{ left: '16rem', borderColor: '#E9EEF2', height: '52px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <span className="flex-1" />

      {/* Bell */}
      <button
        className="relative p-2 rounded-xl transition-colors hover:bg-gray-50"
        style={{ color: '#9CA3AF' }}
        title="Notificações"
      >
        <Bell size={18} />
      </button>

      {/* Divider */}
      <div className="h-6 w-px mx-1" style={{ backgroundColor: '#E9EEF2' }} />

      {/* User */}
      <button className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl transition-colors hover:bg-gray-50">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
          style={{
            background: 'linear-gradient(135deg, #12C6D6 0%, #0FBDCC 100%)',
            boxShadow: '0 2px 6px rgba(18,198,214,0.3)',
          }}
        >
          {initials}
        </div>
        <span className="text-sm font-medium max-w-[140px] truncate" style={{ color: '#1F2937' }}>
          {nome}
        </span>
        <ChevronDown size={14} style={{ color: '#9CA3AF' }} />
      </button>
    </div>
  )
}
