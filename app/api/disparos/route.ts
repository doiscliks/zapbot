import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readConfig } from '@/lib/config-server'
import { getTenantId } from '@/lib/tenant-auth'

export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await readConfig()
  const supabase = createClient(config.supabaseUrl!, config.supabaseAnonKey!)

  const { nome, mensagem, contatos } = await request.json()

  if (!nome || !mensagem || !contatos?.length) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  const { data: campanha, error: errCampanha } = await supabase
    .from('campanhas_disparo')
    .insert({ nome, mensagem, total: contatos.length, status: 'a_enviar', user_id: userId })
    .select()
    .single()

  if (errCampanha) return NextResponse.json({ error: errCampanha.message }, { status: 500 })

  const rows = contatos.map((c: { nome?: string; telefone: string }) => ({
    campanha_id: campanha.id,
    nome: c.nome || null,
    telefone: c.telefone,
    status: 'a_enviar',
  }))

  const { error: errContatos } = await supabase.from('disparo_contatos').insert(rows)
  if (errContatos) return NextResponse.json({ error: errContatos.message }, { status: 500 })

  return NextResponse.json({ id: campanha.id })
}

export async function GET(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await readConfig()
  const supabase = createClient(config.supabaseUrl!, config.supabaseAnonKey!)

  const { data, error } = await supabase
    .from('campanhas_disparo')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
