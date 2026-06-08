import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'
import { readConfig } from '@/lib/config-server'
import { getUazapiBase, buscarFotoPerfil } from '@/lib/uazapi'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

const LOTE = 20

// Busca a foto de perfil dos clientes que ainda não têm uma (em lotes).
export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()

  const { data: instancia } = await supabase
    .from('instancias_whatsapp')
    .select('token')
    .eq('user_id', userId)
    .eq('status', 'conectado')
    .limit(1)
    .maybeSingle()

  if (!instancia?.token) {
    return NextResponse.json({ ok: true, atualizadas: 0, restantes: false, motivo: 'sem_instancia_conectada' })
  }

  const config = await readConfig()
  const uazapiBase = config.uazapiUrl ? getUazapiBase(config.uazapiUrl) : ''
  if (!uazapiBase) {
    return NextResponse.json({ ok: true, atualizadas: 0, restantes: false, motivo: 'sem_uazapi_url' })
  }

  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, telefone')
    .eq('user_id', userId)
    .is('foto', null)
    .not('telefone', 'is', null)
    .order('dt_ultima_mensagem', { ascending: false, nullsFirst: false })
    .limit(LOTE)

  if (!clientes || clientes.length === 0) {
    return NextResponse.json({ ok: true, atualizadas: 0, restantes: false })
  }

  const token = instancia.token as string
  const resultados = await Promise.all(
    clientes.map(async (c) => {
      const foto = await buscarFotoPerfil(uazapiBase, token, c.telefone as string)
      if (foto) {
        await supabase.from('clientes').update({ foto }).eq('id', c.id)
        return true
      }
      return false
    })
  )

  const atualizadas = resultados.filter(Boolean).length
  // Se o lote veio cheio, provavelmente ainda há mais clientes sem foto
  return NextResponse.json({ ok: true, atualizadas, restantes: clientes.length === LOTE })
}
