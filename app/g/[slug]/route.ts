import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseEnv } from '@/lib/config-server'

function getSupabase() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()
  return createClient(supabaseUrl, supabaseAnonKey)
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = getSupabase()

  const { data: rotator } = await supabase
    .from('grupos_rotators')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!rotator) {
    return new NextResponse('Grupo não encontrado', { status: 404 })
  }

  const { data: link } = await supabase
    .from('grupos_links')
    .select('id, url, contador_acessos, participantes')
    .eq('rotator_id', rotator.id)
    .eq('ativo', true)
    .order('participantes', { ascending: true })
    .order('contador_acessos', { ascending: true })
    .limit(1)
    .single()

  if (!link) {
    return new NextResponse('Nenhum grupo disponível no momento', { status: 404 })
  }

  // Incrementa o contador em background (não bloqueia o redirect)
  supabase
    .from('grupos_links')
    .update({ contador_acessos: link.contador_acessos + 1 })
    .eq('id', link.id)
    .then(() => {})

  return NextResponse.redirect(link.url)
}
