import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function GET(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('coleta_dados_config')
    .select('ativo, campos')
    .eq('user_id', userId)
    .maybeSingle()

  // Se a tabela ainda não existe (migração não rodada), devolve config vazia em vez de 500
  if (error) return NextResponse.json({ ativo: false, campos: [] })

  return NextResponse.json({
    ativo: data?.ativo ?? false,
    campos: data?.campos ?? [],
  })
}

export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const supabase = getSupabase()

  const campos: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() }
  if (body.ativo !== undefined) campos.ativo = body.ativo
  if (body.campos !== undefined) {
    // Normaliza: garante chave (slug) e label em cada campo
    const lista = Array.isArray(body.campos) ? body.campos : []
    campos.campos = lista
      .map((c: { chave?: string; label?: string; descricao?: string }) => {
        const label = (c.label || '').trim()
        const chave = (c.chave || label)
          .toLowerCase()
          .normalize('NFD').replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
        return { chave, label, descricao: (c.descricao || '').trim() }
      })
      .filter((c: { chave: string; label: string }) => c.chave && c.label)
  }

  const { error } = await supabase
    .from('coleta_dados_config')
    .upsert(campos, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
