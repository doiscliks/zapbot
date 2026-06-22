'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { initSupabaseClient } from '@/lib/supabase'

const PUBLIC_ROUTES = ['/setup', '/setup/login', '/agendar']

export default function ConfigProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [ready, setReady] = useState(false)

  // Debug: mostra pathname IMEDIATAMENTE
  if (typeof window !== 'undefined') {
    console.log('[ConfigProvider] INICIAL pathname:', pathname, 'startsWith /agendar:', pathname.startsWith('/agendar'))
  }

  useEffect(() => {
    console.log('[ConfigProvider] pathname:', pathname, 'isPublic:', PUBLIC_ROUTES.some((r) => pathname.startsWith(r)))
    fetch('/api/config')
      .then((r) => r.json())
      .then((config) => {
        console.log('[ConfigProvider] config:', !!config.supabaseUrl)
        if (config.supabaseUrl && config.supabaseAnonKey) {
          initSupabaseClient(config.supabaseUrl, config.supabaseAnonKey)
          setReady(true)
        } else {
          // Não configurado — redireciona para setup (exceto se for rota pública)
          const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))
          console.log('[ConfigProvider] isPublicRoute:', isPublicRoute)
          if (!isPublicRoute) {
            console.log('[ConfigProvider] Redirecionando para /setup/login')
            router.replace('/setup/login')
          } else {
            console.log('[ConfigProvider] É rota pública, passando')
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
