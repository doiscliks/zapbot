import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

function gerarSlug(nome: string): string {
  const base = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${base}-${Math.random().toString(36).substring(2, 7)}`
}

export async function GET(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('grupos_rotators')
    .select('*, grupos_links(*)')
    .eq('user_id', userId)
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const resultado = (data ?? []).map((r) => ({
    ...r,
    links: ((r.grupos_links ?? []) as Record<string, unknown>[]).sort(
      (a, b) => new Date(a.criado_em as string).getTime() - new Date(b.criado_em as string).getTime()
    ),
  }))

  return NextResponse.json(resultado)
}

export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { nome } = await request.json()
  if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('grupos_rotators')
    .insert({ nome: nome.trim(), slug: gerarSlug(nome), user_id: userId })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, links: [] })
}
