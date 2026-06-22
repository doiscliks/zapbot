'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { initSupabaseClient } from '@/lib/supabase'

const PUBLIC_ROUTES = ['/setup', '/setup/login', '/agendar']

export default function ConfigProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((config) => {
        if (config.supabaseUrl && config.supabaseAnonKey) {
          initSupabaseClient(config.supabaseUrl, config.supabaseAnonKey)
          setReady(true)
        } else {
          // Não configurado — redireciona para setup (exceto se for rota pública)
          const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))
          if (!isPublicRoute) {
            router.replace('/setup/login')
          } else {
            setReady(true)
          }
        }
      })
      .catch(() => setReady(true))
  }, [pathname, router])

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
