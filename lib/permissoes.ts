import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUsuarioId } from '@/lib/tenant-auth'
import { podeAcessar } from '@/lib/screens'

// Reexporta os helpers puros para quem já importa de '@/lib/permissoes'.
export * from '@/lib/screens'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

// Checagem server-side: o usuário logado pode acessar a tela `key`?
// Admin (parent_id nulo) = sempre true.
export async function temPermissao(request: NextRequest, key: string): Promise<boolean> {
  const usuarioId = getUsuarioId(request)
  if (!usuarioId) return false
  const supabase = getSupabase()
  const { data } = await supabase
    .from('usuarios')
    .select('parent_id, permissoes, ativo')
    .eq('id', usuarioId)
    .single()
  if (!data || data.ativo === false) return false
  if (!data.parent_id) return true // conta de topo = admin
  return podeAcessar(data.permissoes, key)
}

// Checagem server-side: o usuário logado é o admin (dono do workspace)?
export async function ehAdmin(request: NextRequest): Promise<boolean> {
  const usuarioId = getUsuarioId(request)
  if (!usuarioId) return false
  const supabase = getSupabase()
  const { data } = await supabase
    .from('usuarios')
    .select('parent_id, ativo')
    .eq('id', usuarioId)
    .single()
  return !!data && data.ativo !== false && !data.parent_id
}
