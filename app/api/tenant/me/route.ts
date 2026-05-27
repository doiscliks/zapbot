import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function GET(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()
  const { data } = await supabase
    .from('usuarios')
    .select('id, nome, email, validade, ativo')
    .eq('id', userId)
    .single()

  // Sessão temporária (sem chave vinculada ainda)
  if (!data) {
    return NextResponse.json({ needsKey: true })
  }

  if (!data.ativo) {
    return NextResponse.json({ error: 'Conta desativada' }, { status: 401 })
  }

  if (new Date(data.validade) < new Date()) {
    return NextResponse.json({ keyExpired: true, nome: data.nome })
  }

  return NextResponse.json({ ok: true, id: data.id, nome: data.nome, email: data.email })
}
