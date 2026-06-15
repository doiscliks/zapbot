'use client'

import { useEffect, useState } from 'react'
import { Users, Search, Edit2, X, Save, Loader2, AlertCircle, Phone, Mail } from 'lucide-react'
import { Cliente } from '@/types'

const ACCENT = '#12C6D6'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  const [editando, setEditando] = useState<string | null>(null)
  const [formEdicao, setFormEdicao] = useState<Partial<Cliente>>({})
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/clientes')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar clientes')
      setClientes(Array.isArray(data) ? data : [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!busca.trim()) {
      setClientesFiltrados(clientes)
      return
    }

    const termo = busca.toLowerCase()
    setClientesFiltrados(
      clientes.filter(
        (c) =>
          c.nome?.toLowerCase().includes(termo) ||
          c.telefone?.toLowerCase().includes(termo) ||
          c.email?.toLowerCase().includes(termo) ||
          c.cpf_cnpj?.toLowerCase().includes(termo)
      )
    )
  }, [busca, clientes])

  async function abrirEdicao(cliente: Cliente) {
    setEditando(cliente.id.toString())
    setFormEdicao(cliente)
  }

  async function salvarEdicao() {
    if (!editando) return

    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/clientes/${editando}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formEdicao),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')

      setClientes((prev) => prev.map((c) => (c.id.toString() === editando ? data : c)))
      setEditando(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2'
  const inputStyle = { borderColor: '#E9EEF2', '--tw-ring-color': ACCENT } as React.CSSProperties

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(18,198,214,0.12)' }}>
            <Users size={20} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1F2937' }}>Clientes</h1>
            <p className="text-sm" style={{ color: '#6B7280' }}>Gerencie os dados pessoais e informações dos clientes.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 border rounded-lg" style={{ borderColor: '#E9EEF2' }}>
          <Search size={18} style={{ color: '#9CA3AF' }} />
          <input
            type="text"
            placeholder="Buscar por nome, telefone, email ou CPF..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: '#1F2937' }}
          />
        </div>
      </div>

      {erro && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          <AlertCircle size={16} /> {erro}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10" style={{ color: '#9CA3AF' }}>
          <Loader2 size={18} className="animate-spin" /> Carregando...
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="text-center py-12" style={{ color: '#9CA3AF' }}>
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum cliente encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clientesFiltrados.map((cliente) => (
            <div key={cliente.id} className="bg-white rounded-xl border p-4" style={{ borderColor: '#E9EEF2' }}>
              {editando === cliente.id.toString() ? (
                // Modo edição
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Nome"
                      value={formEdicao.nome || ''}
                      onChange={(e) => setFormEdicao({ ...formEdicao, nome: e.target.value })}
                      className={inputCls}
                      style={inputStyle}
                    />
                    <input
                      type="tel"
                      placeholder="Telefone"
                      value={formEdicao.telefone || ''}
                      onChange={(e) => setFormEdicao({ ...formEdicao, telefone: e.target.value })}
                      className={inputCls}
                      style={inputStyle}
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={formEdicao.email || ''}
                      onChange={(e) => setFormEdicao({ ...formEdicao, email: e.target.value })}
                      className={inputCls}
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      placeholder="CPF / CNPJ"
                      value={formEdicao.cpf_cnpj || ''}
                      onChange={(e) => setFormEdicao({ ...formEdicao, cpf_cnpj: e.target.value })}
                      className={inputCls}
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      placeholder="Empresa"
                      value={formEdicao.empresa || ''}
                      onChange={(e) => setFormEdicao({ ...formEdicao, empresa: e.target.value })}
                      className={inputCls}
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      placeholder="Cargo"
                      value={formEdicao.cargo || ''}
                      onChange={(e) => setFormEdicao({ ...formEdicao, cargo: e.target.value })}
                      className={inputCls}
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      placeholder="Endereço"
                      value={formEdicao.endereco || ''}
                      onChange={(e) => setFormEdicao({ ...formEdicao, endereco: e.target.value })}
                      className={inputCls}
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      placeholder="Número"
                      value={formEdicao.numero_endereco || ''}
                      onChange={(e) => setFormEdicao({ ...formEdicao, numero_endereco: e.target.value })}
                      className={inputCls}
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      placeholder="Complemento"
                      value={formEdicao.complemento || ''}
                      onChange={(e) => setFormEdicao({ ...formEdicao, complemento: e.target.value })}
                      className={inputCls}
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      placeholder="Bairro"
                      value={formEdicao.bairro || ''}
                      onChange={(e) => setFormEdicao({ ...formEdicao, bairro: e.target.value })}
                      className={inputCls}
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      placeholder="Cidade"
                      value={formEdicao.cidade || ''}
                      onChange={(e) => setFormEdicao({ ...formEdicao, cidade: e.target.value })}
                      className={inputCls}
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      placeholder="CEP"
                      value={formEdicao.cep || ''}
                      onChange={(e) => setFormEdicao({ ...formEdicao, cep: e.target.value })}
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  <textarea
                    placeholder="Notas"
                    value={formEdicao.notas || ''}
                    onChange={(e) => setFormEdicao({ ...formEdicao, notas: e.target.value })}
                    className={`${inputCls} resize-none`}
                    style={inputStyle}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={salvarEdicao}
                      disabled={salvando}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                      style={{ background: ACCENT }}
                    >
                      {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                      Salvar
                    </button>
                    <button
                      onClick={() => setEditando(null)}
                      disabled={salvando}
                      className="px-4 py-2 rounded-lg text-sm font-medium border"
                      style={{ borderColor: '#E9EEF2', color: '#6B7280' }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                // Modo visualização
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ color: '#1F2937' }}>
                        {cliente.nome || 'Sem nome'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs" style={{ color: '#6B7280' }}>
                        {cliente.telefone && (
                          <span className="flex items-center gap-1">
                            <Phone size={12} /> {cliente.telefone}
                          </span>
                        )}
                        {cliente.email && (
                          <span className="flex items-center gap-1">
                            <Mail size={12} /> {cliente.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => abrirEdicao(cliente)}
                      className="p-2 rounded-lg hover:bg-gray-50 text-gray-500 hover:text-gray-700"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                  {(cliente.empresa || cliente.cpf_cnpj || cliente.cidade) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs" style={{ color: '#9CA3AF' }}>
                      {cliente.empresa && <p><strong>Empresa:</strong> {cliente.empresa}</p>}
                      {cliente.cpf_cnpj && <p><strong>CPF/CNPJ:</strong> {cliente.cpf_cnpj}</p>}
                      {cliente.cidade && <p><strong>Cidade:</strong> {cliente.cidade}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
