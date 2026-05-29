import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET(request: NextRequest) {
  const slug = new URL(request.url).searchParams.get('slug')
  if (!slug) return NextResponse.json(null)

  const supabase = getSupabase()
  const { data } = await supabase
    .from('agenda_config')
    .select('titulo, descricao, duracao_minutos, dias_semana, dias_antecedencia_maxima, periodos, ativo')
    .eq('slug', slug)
    .single()

  return NextResponse.json(data ?? null)
}
