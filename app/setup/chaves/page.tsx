'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Key, Plus, Trash2, Loader2, CheckCircle, AlertCircle, Clock, User, RefreshCw, Smartphone, Mail, Copy } from 'lucide-react'

interface Chave {
  id: string
  nome: string | null
  email: string | null
  chave_acesso: string
  validade: string
  ativo: boolean
  usado_em: string | null
  created_at: string
  instancias_permitidas: number
}

function diasRestantes(validade: string): number {
  const diff = new Date(validade).getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function ChavesPage() {
  const router = useRouter()
  const [chaves, setChaves] = useState<Chave[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [dias, setDias] = useState('30')
  const [instancias, setInstancias] = useState('1')
  const [extendId, setExtendId] = useState<string | null>(null)
  const [extendDias, setExtendDias] = useState('30')
  const [editInstanciasId, setEditInstanciasId] = useState<string | null>(null)
  const [editInstanciasVal, setEditInstanciasVal] = useState('1')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    const res = await fetch('/api/chaves')
    if (res.status === 401) { router.replace('/setup/login'); return }
    if (res.ok) setChaves(await res.json())
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  function mostrarFeedback(msg: string) {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 4000)
  }

  async function criarChave(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    const res = await fetch('/api/chaves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dias: Number(dias), instancias_permitidas: Number(instancias) }),
    })
    const data = await res.json()
    if (!res.ok) { setErro(data.error ?? 'Erro ao criar chave'); setSalvando(false); return }
    setChaves((prev) => [data, ...prev])
    mostrarFeedback('Chave criada!')
    setSalvando(false)
  }

  async function toggleAtivo(chave: Chave) {
    const res = await fetch(`/api/chaves/${chave.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !chave.ativo }),
    })
    if (res.ok) {
      const updated = await res.json()
      setChaves((prev) => prev.map((c) => (c.id === chave.id ? updated : c)))
    }
  }

  async function estender(id: string) {
    const res = await fetch(`/api/chaves/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dias: Number(extendDias) }),
    })
    if (res.ok) {
      const updated = await res.json()
      setChaves((prev) => prev.map((c) => (c.id === id ? updated : c)))
      setExtendId(null)
      mostrarFeedback('Validade estendida!')
    }
  }

  async function salvarInstancias(id: string) {
    const res = await fetch(`/api/chaves/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instancias_permitidas: Number(editInstanciasVal) }),
    })
    if (res.ok) {
      const updated = await res.json()
      setChaves((prev) => prev.map((c) => (c.id === id ? updated : c)))
      setEditInstanciasId(null)
      mostrarFeedback('Limite atualizado!')
    }
  }

  async function deletar(id: string) {
    if (!confirm('Excluir esta chave? O usuário perderá acesso imediatamente.')) return
    const res = await fetch(`/api/chaves/${id}`, { method: 'DELETE' })
    if (res.ok) { setChaves((prev) => prev.filter((c) => c.id !== id)); mostrarFeedback('Chave removida.') }
  }

  function copiar(texto: string) {
    navigator.clipboard.writeText(texto)
    mostrarFeedback('Chave copiada!')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-4 py-12">
      <div className="w-full max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Key size={20} className="text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Chaves de Acesso</h1>
              <p className="text-gray-400 text-sm">Gere e gerencie o acesso dos clientes</p>
            </div>
          </div>
          <button onClick={() => router.push('/setup')} className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Voltar ao setup
          </button>
        </div>

        {/* Criar chave */}
        <div className="bg-white rounded-2xl p-6 shadow-xl mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Nova chave de acesso</h2>
          <form onSubmit={criarChave} className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Duração (dias)</label>
              <input type="number" min={1} max={3650} value={dias} onChange={(e) => setDias(e.target.value)}
                className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Instâncias permitidas</label>
              <input type="number" min={1} max={100} value={instancias} onChange={(e) => setInstancias(e.target.value)}
                className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <button type="submit" disabled={salvando}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium">
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Gerar chave
            </button>
          </form>
          {erro && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg mt-3">
              <AlertCircle size={14} /> {erro}
            </div>
          )}
        </div>

        {feedback && (
          <div className="flex items-center gap-2 bg-green-900/50 border border-green-700 text-green-300 text-sm px-4 py-3 rounded-xl mb-4">
            <CheckCircle size={15} /> {feedback}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-3 text-gray-400 py-8 justify-center">
            <Loader2 size={20} className="animate-spin" /> Carregando...
          </div>
        ) : chaves.length === 0 ? (
          <div className="bg-white/5 rounded-2xl p-12 text-center">
            <Key size={40} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Nenhuma chave criada ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {chaves.map((chave) => {
              const dias = diasRestantes(chave.validade)
              const expirada = dias < 0
              const expirando = dias >= 0 && dias <= 7

              return (
                <div key={chave.id} className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">

                      {/* Chave */}
                      <div className="flex items-center gap-2 mb-2">
                        <code className="text-base font-mono font-bold text-gray-900 tracking-widest">
                          {chave.chave_acesso}
                        </code>
                        <button onClick={() => copiar(chave.chave_acesso)} title="Copiar chave"
                          className="p-1 rounded text-gray-400 hover:text-green-600 transition-colors">
                          <Copy size={13} />
                        </button>
                        {!chave.ativo && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inativa</span>
                        )}
                      </div>

                      {/* Usuário vinculado */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                        <User size={11} />
                        {chave.nome ? (
                          <span className="font-medium text-gray-700">{chave.nome}</span>
                        ) : (
                          <span className="italic text-gray-400">Não utilizada</span>
                        )}
                        {chave.usado_em && (
                          <span className="text-gray-400">· desde {formatDate(chave.usado_em)}</span>
                        )}
                      </div>

                      {/* Email vinculado */}
                      {chave.email && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                          <Mail size={11} /> {chave.email}
                        </div>
                      )}

                      {/* Validade */}
                      <div className={`flex items-center gap-1.5 text-xs mb-1 ${expirada ? 'text-red-600' : expirando ? 'text-yellow-600' : 'text-gray-500'}`}>
                        <Clock size={11} />
                        {expirada ? `Expirada há ${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? 's' : ''}`
                          : dias === 0 ? 'Expira hoje'
                          : `${dias} dia${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}`}
                        <span className="text-gray-400">· vence em {formatDate(chave.validade)}</span>
                      </div>

                      {/* Instâncias */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Smartphone size={11} />
                        {editInstanciasId === chave.id ? (
                          <div className="flex items-center gap-2">
                            <input type="number" min={1} max={100} value={editInstanciasVal}
                              onChange={(e) => setEditInstanciasVal(e.target.value)} autoFocus
                              className="w-16 px-2 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-green-500" />
                            <button onClick={() => salvarInstancias(chave.id)} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Salvar</button>
                            <button onClick={() => setEditInstanciasId(null)} className="text-xs text-gray-400">Cancelar</button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditInstanciasId(chave.id); setEditInstanciasVal(String(chave.instancias_permitidas ?? 1)) }}
                            className="hover:text-green-600 transition-colors">
                            {chave.instancias_permitidas ?? 1} instância{(chave.instancias_permitidas ?? 1) !== 1 ? 's' : ''} permitida{(chave.instancias_permitidas ?? 1) !== 1 ? 's' : ''}
                          </button>
                        )}
                      </div>

                      {/* Estender validade */}
                      {extendId === chave.id && (
                        <div className="flex items-center gap-2 mt-3">
                          <input type="number" min={1} value={extendDias} onChange={(e) => setExtendDias(e.target.value)} autoFocus
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                          <span className="text-xs text-gray-500">dias</span>
                          <button onClick={() => estender(chave.id)} className="text-xs bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1 rounded-lg font-medium">Confirmar</button>
                          <button onClick={() => setExtendId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
                        </div>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => { setExtendId(chave.id); setExtendDias('30') }} title="Estender validade"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors">
                        <RefreshCw size={14} />
                      </button>
                      <button onClick={() => toggleAtivo(chave)}
                        className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${chave.ativo ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}>
                        {chave.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                      <button onClick={() => deletar(chave.id)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
