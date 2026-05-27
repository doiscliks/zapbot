'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, MessageSquare, LogOut, Kanban, BookOpen, TrendingUp,
  Users, Menu, X, Filter, Send, Bell, Smartphone, Settings, Zap,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/mensagens', label: 'Mensagens', icon: MessageSquare },
  { href: '/disparos', label: 'Disparos', icon: Send },
  { href: '/remarketing', label: 'Remarketing', icon: Bell },
  { href: '/fluxos', label: 'Fluxos', icon: Zap },
  { href: '/kanban', label: 'Kanban', icon: Kanban },
  { href: '/funil', label: 'Funil', icon: Filter },
  { href: '/ads', label: 'Ads', icon: TrendingUp },
  { href: '/treinamento', label: 'Treinamento', icon: BookOpen },
  { href: '/grupos', label: 'Grupos', icon: Users },
  { href: '/conexao', label: 'Conexão', icon: Smartphone },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
]

function Logo2Cliks() {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
        style={{ background: 'linear-gradient(135deg, #12C6D6 0%, #0FBDCC 100%)', boxShadow: '0 2px 8px rgba(18,198,214,0.35)' }}
      >
        2C
      </div>
      <div className="leading-none">
        <p className="font-semibold text-sm tracking-tight" style={{ color: '#1F2937' }}>2Cliks</p>
        <p className="text-[10px] mt-0.5 font-medium" style={{ color: '#12C6D6' }}>Contabilidade</p>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [aberto, setAberto] = useState(false)

  async function handleSignOut() {
    await fetch('/api/tenant/logout', { method: 'POST' })
    router.push('/login')
  }

  function fechar() {
    setAberto(false)
  }

  const navContent = (
    <>
      {/* Logo */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: '#E9EEF2' }}
      >
        <Logo2Cliks />
        <button
          onClick={fechar}
          className="md:hidden p-1.5 rounded-lg transition-colors hover:bg-gray-100"
          style={{ color: '#6B7280' }}
        >
          <X size={17} />
        </button>
      </div>

      {/* Nav section label */}
      <div className="px-5 pt-5 pb-1">
        <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#9CA3AF' }}>
          Menu
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={fechar}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                active
                  ? 'text-white'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              }`}
              style={
                active
                  ? {
                      background: 'linear-gradient(135deg, #12C6D6 0%, #0FBDCC 100%)',
                      boxShadow: '0 2px 8px rgba(18,198,214,0.3)',
                    }
                  : {}
              }
            >
              <Icon size={17} className="shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 pb-4 pt-3 border-t" style={{ borderColor: '#E9EEF2' }}>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-150"
        >
          <LogOut size={17} className="shrink-0" />
          Sair
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setAberto(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-xl bg-white border shadow-md transition-colors hover:bg-gray-50"
        style={{ borderColor: '#E9EEF2', color: '#1F2937' }}
      >
        <Menu size={20} />
      </button>

      {/* Overlay */}
      {aberto && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/25 backdrop-blur-sm"
          onClick={fechar}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-white shadow-2xl transform transition-transform duration-200 ${
          aberto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-64 min-h-screen bg-white border-r"
        style={{ borderColor: '#E9EEF2' }}
      >
        {navContent}
      </aside>
    </>
  )
}
