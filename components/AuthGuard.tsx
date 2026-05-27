'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ok, setOk] = useState(false)

  useEffect(() => {
    fetch('/api/tenant/me').then(async (r) => {
      const data = await r.json()
      if (data.ok) { setOk(true); return }
      router.replace('/login')
    }).catch(() => router.replace('/login'))
  }, [])

  if (!ok) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
