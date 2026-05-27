import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readConfig } from '@/lib/config-server'
import { getTenantId } from '@/lib/tenant-auth'

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function aplicarVariaveis(mensagem: string, nome?: string) {
  return mensagem.replace(/\{\{nome\}\}/gi, nome || 'cliente')
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const config = await readConfig()
  const supabase = createClient(config.supabaseUrl!, config.supabaseAnonKey!)

  const uazapiBase = config.uazapiUrl?.replace(/\/+$/, '').replace(/\/send\/.*$/, '')

  if (!uazapiBase) {
    return NextResponse.json({ error: 'UAZAPI não configurada' }, { status: 500 })
  }

  let instanciaId: string | undefined
  try {
    const body = await request.json()
    instanciaId = body.instancia_id
  } catch { /* body opcional */ }

  let instanciaQuery = supabase
    .from('instancias_whatsapp')
    .select('token')
    .eq('user_id', userId)
    .eq('status', 'conectado')

  if (instanciaId) {
    instanciaQuery = instanciaQuery.eq('id', instanciaId)
  }

  const { data: instancia } = await instanciaQuery.limit(1).single()

  if (!instancia) {
    return NextResponse.json(
      { error: 'Instância WhatsApp não encontrada ou não conectada.' },
      { status: 400 }
    )
  }

  // Verifica que a campanha pertence ao usuário
  const { data: campanha } = await supabase
    .from('campanhas_disparo')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!campanha) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

  // Busca contatos pendentes
  const { data: contatos } = await supabase
    .from('disparo_contatos')
    .select('*')
    .eq('campanha_id', id)
    .eq('status', 'a_enviar')

  if (!contatos?.length) {
    return NextResponse.json({ ok: true, enviados: 0 })
  }

  let enviados = 0
  let erros = 0

  for (const contato of contatos) {
    const texto = aplicarVariaveis(campanha.mensagem, contato.nome)

    try {
      const res = await fetch(`${uazapiBase}/send/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: instancia.token },
        body: JSON.stringify({ number: contato.telefone, text: texto }),
      })

      if (res.ok) {
        await supabase.from('disparo_contatos').update({ status: 'enviado' }).eq('id', contato.id)

        const telefone = contato.telefone.replace('@s.whatsapp.net', '')
        const agora = new Date().toISOString()

        // Salva mensagem no histórico do cliente
        await supabase.from('mensagens_whatsapp').insert({
          numero_cliente: telefone,
          mensagem: texto,
          quem_mandou: 'agente',
          status: 'enviada',
          data_criacao: agora,
          user_id: userId,
        })

        // Cria ou atualiza o cliente para aparecer na aba mensagens
        const { data: clienteExistente } = await supabase
          .from('clientes')
          .select('id')
          .eq('telefone', telefone)
          .eq('user_id', userId)
          .maybeSingle()

        if (clienteExistente) {
          await supabase.from('clientes')
            .update({ dt_ultima_mensagem: agora, instancia_id: instancia.token })
            .eq('id', clienteExistente.id)
        } else {
          await supabase.from('clientes').insert({
            nome: contato.nome || telefone,
            telefone,
            instancia_id: instancia.token,
            dt_ultima_mensagem: agora,
            user_id: userId,
          })
        }

        enviados++
      } else {
        const err = await res.json().catch(() => ({}))
        await supabase.from('disparo_contatos').update({ status: 'erro', erro: JSON.stringify(err) }).eq('id', contato.id)
        erros++
      }
    } catch (e) {
      await supabase.from('disparo_contatos').update({ status: 'erro', erro: String(e) }).eq('id', contato.id)
      erros++
    }

    await sleep(1500)
  }

  await supabase
    .from('campanhas_disparo')
    .update({ enviados, erros, status: erros === contatos.length ? 'erro' : 'enviado' })
    .eq('id', id)

  return NextResponse.json({ ok: true, enviados, erros })
}
