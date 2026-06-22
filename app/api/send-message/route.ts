import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readConfig } from '@/lib/config-server'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await readConfig()
  const uazapiBase = config.uazapiUrl?.replace(/\/+$/, '').replace(/\/send\/.*$/, '')

  const { numero, mensagem, instancia_id } = await request.json()

  if (!numero || !mensagem) {
    return NextResponse.json({ error: 'numero e mensagem são obrigatórios' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Verifica permissão: se atendente, só pode enviar para conversas atribuídas a ele
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('parent_id, is_attendant')
    .eq('id', userId)
    .maybeSingle()

  if (!usuario) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = !usuario.parent_id
  const isAtendente = usuario.is_attendant

  if (!isAdmin && isAtendente) {
    const numeroSemSufixo = String(numero).split('@')[0]
    const { data: cliente } = await supabase
      .from('clientes')
      .select('assigned_user_id')
      .eq('telefone', numeroSemSufixo)
      .eq('user_id', userId)
      .maybeSingle()

    if (!cliente || cliente.assigned_user_id !== userId) {
      return NextResponse.json({ error: 'Sem permissão para enviar mensagem nesta conversa' }, { status: 403 })
    }
  }

  // Se usuário é sub-usuário, usa parent_id (admin) para buscar instância
  const workspaceAdminId = usuario.parent_id || userId

  // Busca token da instância: por instancia_id se passado, senão pega a conectada do workspace
  let uazapiToken: string | null = null
  if (instancia_id) {
    const { data } = await supabase
      .from('instancias_whatsapp')
      .select('token')
      .eq('id', instancia_id)
      .eq('user_id', workspaceAdminId)
      .maybeSingle()
    uazapiToken = data?.token ?? null
  } else {
    const { data } = await supabase
      .from('instancias_whatsapp')
      .select('token')
      .eq('user_id', workspaceAdminId)
      .eq('status', 'conectado')
      .limit(1)
      .maybeSingle()
    uazapiToken = data?.token ?? null
  }

  if (!uazapiBase || !uazapiToken) {
    return NextResponse.json({ error: 'Nenhuma instância WhatsApp conectada' }, { status: 400 })
  }

  const response = await fetch(`${uazapiBase}/send/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: uazapiToken },
    body: JSON.stringify({ number: numero, text: mensagem }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    return NextResponse.json({ error: 'Falha ao enviar mensagem', detail: data }, { status: response.status })
  }

  // Persiste a mensagem enviada com o user_id do workspace, para aparecer no
  // histórico (o webhook ignora o echo wasSentByApi, então a gravação é aqui).
  const agora = new Date().toISOString()
  const numeroSemSufixo = String(numero).split('@')[0]
  const { error: insertErr } = await supabase.from('mensagens_whatsapp').insert({
    numero_cliente: numeroSemSufixo,
    mensagem,
    quem_mandou: 'manual',
    status: 'enviada',
    data_criacao: agora,
    user_id: userId,
  })

  // Atualiza a última interação do cliente para a conversa subir na lista
  await supabase
    .from('clientes')
    .update({ dt_ultima_mensagem: agora })
    .eq('telefone', numeroSemSufixo)
    .eq('user_id', userId)

  return NextResponse.json({ ok: true, data, salvo: !insertErr, erro_salvar: insertErr?.message })
}
