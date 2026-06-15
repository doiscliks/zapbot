'use client'

import { useEffect, useState } from 'react'
import { Users, Search, Edit2, Loader2, AlertCircle, Phone, Mail } from 'lucide-react'
import { Cliente } from '@/types'
import EditClienteModal from '@/components/EditClienteModal'

const ACCENT = '#12C6D6'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [filtrados, setFiltrados] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null)
  const [salvando, setSalvando] = useState(false)

  const [email, setEmail] = useState('')
  const [cpf, setCpf] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [endereco, setEndereco] = useState('')
  const [cidade, setCidade] = useState('')

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setLoading(true)
    try {
      const res = await fetch('/api/clientes')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setClientes(Array.isArray(data) ? data : [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!busca.trim()) {
      setFiltrados(clientes)
      return
    }
    const termo = busca.toLowerCase()
    setFiltrados(
      clientes.filter(
        (c) =>
          c.nome.toLowerCase().includes(termo) ||
          c.telefone.toLowerCase().includes(termo) ||
          c.email?.toLowerCase().includes(termo) ||
          c.cpf_cnpj?.toLowerCase().includes(termo)
      )
    )
  }, [busca, clientes])

  function abrirEdicao(c: Cliente) {
    setClienteEditando(c)
    setEmail(c.email || '')
    setCpf(c.cpf_cnpj || '')
    setEmpresa(c.empresa || '')
    setEndereco(c.endereco || '')
    setCidade(c.cidade || '')
  }

  function fecharEdicao() {
    setClienteEditando(null)
    setEmail('')
    setCpf('')
    setEmpresa('')
    setEndereco('')
    setCidade('')
  }

  async function salvar(historico?: any[]) {
    if (!clienteEditando) return
    setSalvando(true)
    try {
      const res = await fetch(`/api/clientes/${clienteEditando.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, cpf_cnpj: cpf, empresa, endereco, cidade, historico }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setClientes((prev) => prev.map((c) => (c.id === clienteEditando.id ? data : c)))
      fecharEdicao()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(18,198,214,0.12)' }}>
            <Users size={20} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1F2937' }}>Clientes</h1>
            <p className="text-sm" style={{ color: '#6B7280' }}>Gerencie os dados dos clientes.</p>
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
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12" style={{ color: '#9CA3AF' }}>
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum cliente encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map((cliente) => (
            <div key={cliente.id} className="bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow" style={{ borderColor: '#E9EEF2' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-sm" style={{ color: '#1F2937' }}>
                    {cliente.nome}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs" style={{ color: '#6B7280' }}>
                    <span className="flex items-center gap-1">
                      <Phone size={12} /> {cliente.telefone}
                    </span>
                    {cliente.email && (
                      <span className="flex items-center gap-1">
                        <Mail size={12} /> {cliente.email}
                      </span>
                    )}
                  </div>
                  {(cliente.empresa || cliente.cpf_cnpj || cliente.cidade) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs mt-2" style={{ color: '#9CA3AF' }}>
                      {cliente.empresa && <p><strong>Empresa:</strong> {cliente.empresa}</p>}
                      {cliente.cpf_cnpj && <p><strong>CPF/CNPJ:</strong> {cliente.cpf_cnpj}</p>}
                      {cliente.cidade && <p><strong>Cidade:</strong> {cliente.cidade}</p>}
                    </div>
                  )}
                </div>
                <button onClick={() => abrirEdicao(cliente)} className="p-2 rounded-lg hover:bg-gray-50 transition-colors" style={{ color: '#9CA3AF' }}>
                  <Edit2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <EditClienteModal
        cliente={clienteEditando}
        email={email}
        cpf={cpf}
        empresa={empresa}
        endereco={endereco}
        cidade={cidade}
        onEmailChange={setEmail}
        onCpfChange={setCpf}
        onEmpresaChange={setEmpresa}
        onEnderecoChange={setEndereco}
        onCidadeChange={setCidade}
        onSave={salvar}
        onCancel={fecharEdicao}
        loading={salvando}
      />
    </div>
  )
}
