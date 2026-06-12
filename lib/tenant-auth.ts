import { NextRequest } from 'next/server'

// Id do DONO do workspace (conta-mãe). Usado para escopar TODOS os dados.
export function getTenantId(request: NextRequest): string | null {
  return request.cookies.get('tenant_session')?.value ?? null
}

// Id do usuário logado de fato (identidade + permissões).
// Fallback para tenant_session em sessões antigas (sem o cookie novo).
export function getUsuarioId(request: NextRequest): string | null {
  return request.cookies.get('usuario_session')?.value
    ?? request.cookies.get('tenant_session')?.value
    ?? null
}
