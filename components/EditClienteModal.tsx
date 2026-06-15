'use client'

import { Cliente } from '@/types'
import { X } from 'lucide-react'

interface EditClienteModalProps {
  cliente: Cliente | null
  email: string
  cpf: string
  empresa: string
  endereco: string
  cidade: string
  onEmailChange: (value: string) => void
  onCpfChange: (value: string) => void
  onEmpresaChange: (value: string) => void
  onEnderecoChange: (value: string) => void
  onCidadeChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
  loading: boolean
}

export default function EditClienteModal({
  cliente,
  email,
  cpf,
  empresa,
  endereco,
  cidade,
  onEmailChange,
  onCpfChange,
  onEmpresaChange,
  onEnderecoChange,
  onCidadeChange,
  onSave,
  onCancel,
  loading,
}: EditClienteModalProps) {
  if (!cliente) return null

  const inputCls = 'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-1'
  const inputStyle = { borderColor: '#E9EEF2', '--tw-ring-color': '#12C6D6' } as React.CSSProperties

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b" style={{ borderColor: '#E9EEF2' }}>
            <div>
              <h2 className="text-lg font-bold" style={{ color: '#1F2937' }}>
                Editar Cliente
              </h2>
              <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
                {cliente.nome} • {cliente.telefone}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              style={{ color: '#6B7280' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B7280' }}>
                  Email
                </label>
                <input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B7280' }}>
                  CPF/CNPJ
                </label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => onCpfChange(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B7280' }}>
                  Empresa
                </label>
                <input
                  type="text"
                  placeholder="Nome da empresa"
                  value={empresa}
                  onChange={(e) => onEmpresaChange(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B7280' }}>
                  Endereço
                </label>
                <input
                  type="text"
                  placeholder="Rua, avenida..."
                  value={endereco}
                  onChange={(e) => onEnderecoChange(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B7280' }}>
                  Cidade
                </label>
                <input
                  type="text"
                  placeholder="São Paulo"
                  value={cidade}
                  onChange={(e) => onCidadeChange(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-6 border-t" style={{ borderColor: '#E9EEF2' }}>
            <button
              onClick={onSave}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-all"
              style={{ background: '#12C6D6' }}
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all"
              style={{ borderColor: '#E9EEF2', color: '#6B7280' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
