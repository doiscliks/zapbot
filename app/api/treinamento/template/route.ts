import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET() {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', 'prompt_template')
    .maybeSingle()

  return NextResponse.json({ conteudo: data?.valor ?? '' })
}

export async function POST(request: NextRequest) {
  const { conteudo } = await request.json()

  const supabase = getSupabase()
  const { error } = await supabase
    .from('configuracoes')
    .upsert({ chave: 'prompt_template', valor: conteudo }, { onConflict: 'chave' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
