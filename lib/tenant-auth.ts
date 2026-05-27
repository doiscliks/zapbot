import { NextRequest } from 'next/server'

export function getTenantId(request: NextRequest): string | null {
  return request.cookies.get('tenant_session')?.value ?? null
}
