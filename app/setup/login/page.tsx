'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, Loader2 } from 'lucide-react'

export default function MasterLoginPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setLoading(true)

    const res = await fetch('/api/master-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, senha }),
    })

    if (!res.ok) {
      setErro('Usuário ou senha incorretos.')
      setLoading(false)
      return
    }

    router.push('/setup')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center mb-4 shadow-lg">
              <Settings size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Configuração</h1>
            <p className="text-gray-500 text-sm mt-1">Acesso administrativo</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="usuario" className="block text-sm font-medium text-gray-700 mb-1.5">
                Usuário
              </label>
              <input
                id="usuario"
                type="text"
                required
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="admin"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent transition"
              />
            </div>

            <div>
              <label htmlFor="senha" className="block text-sm font-medium text-gray-700 mb-1.5">
                Senha
              </label>
              <input
                id="senha"
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent transition"
              />
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? <><Loader2 size={18} className="animate-spin" /> Entrando...</> : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
