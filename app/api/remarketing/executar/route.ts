import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readConfig } from '@/lib/config-server'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

function dentroDoHorario(horaInicio: string | null, horaFim: string | null): boolean {
  if (!horaInicio || !horaFim) return true
  const atual = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false })
  if (horaInicio <= horaFim) return atual >= horaInicio && atual <= horaFim
  return atual >= horaInicio || atual <= horaFim
}

export async function POST() {
  const supabase = getSupabase()

  // Carrega config UAZAPI
  const config = await readConfig()
  const uazapiBase = config.uazapiUrl?.replace(/\/+$/, '').replace(/\/send\/.*$/, '')

  if (!uazapiBase) {
    return NextResponse.json({ error: 'UAZAPI não configurada' }, { status: 500 })
  }

  // Busca regras ativas
  const { data: regras, error: errRegras } = await supabase
    .from('remarketing_regras')
    .select('*')
    .eq('ativo', true)

  if (errRegras) return NextResponse.json({ error: errRegras.message }, { status: 500 })
  if (!regras || regras.length === 0) return NextResponse.json({ ok: true, enviados: 0, detalhes: [] })

  const agora = new Date()
  const resultados: { regra_id: string; status_alvo: string; enviados: number; erros: number }[] = []

  for (const regra of regras) {
    // Verifica janela de horário
    if (!dentroDoHorario(regra.hora_inicio ?? null, regra.hora_fim ?? null)) {
      resultados.push({ regra_id: regra.id, status_alvo: regra.status_alvo, enviados: 0, erros: 0 })
      continue
    }

    const limiteData = new Date(agora.getTime() - regra.tempo_horas * 60 * 60 * 1000)

    // Clientes na seção alvo com dt_ultima_mensagem mais antiga que o limite
    const secaoId = Number(regra.status_alvo)
    const clientesQuery = supabase
      .from('clientes')
      .select('id, nome, telefone, cidade, dt_ultima_mensagem, instancia_id')
      .eq('user_id', regra.user_id)
      .not('telefone', 'is', null)
      .lt('dt_ultima_mensagem', limiteData.toISOString())

    if (!isNaN(secaoId)) {
      clientesQuery.eq('kanban_secao_id', secaoId)
    } else {
      clientesQuery.eq('status_atual', regra.status_alvo)
    }

    const { data: clientes, error: errClientes } = await clientesQuery

    if (errClientes || !clientes || clientes.length === 0) {
      resultados.push({ regra_id: regra.id, status_alvo: regra.status_alvo, enviados: 0, erros: 0 })
      continue
    }

    // Deduplica por telefone (manter maior id)
    const unicosPorTelefone: Record<string, typeof clientes[0]> = {}
    for (const c of clientes) {
      if (!c.telefone) continue
      if (!unicosPorTelefone[c.telefone] || c.id > unicosPorTelefone[c.telefone].id) {
        unicosPorTelefone[c.telefone] = c
      }
    }
    const clientesUnicos = Object.values(unicosPorTelefone)

    // Busca logs desta regra — conta envios por telefone
    const telefones = clientesUnicos.map((c) => c.telefone)
    const { data: logs } = await supabase
      .from('remarketing_logs')
      .select('telefone')
      .eq('regra_id', regra.id)
      .in('telefone', telefones)

    const maxRep = regra.max_repeticoes ?? 1
    const contagemEnvios: Record<string, number> = {}
    for (const log of logs ?? []) {
      contagemEnvios[log.telefone] = (contagemEnvios[log.telefone] ?? 0) + 1
    }
    let elegíveis = clientesUnicos.filter((c) => (contagemEnvios[c.telefone] ?? 0) < maxRep)

    if (regra.limite && regra.limite > 0) {
      elegíveis = elegíveis.slice(0, regra.limite)
    }

    let enviados = 0
    let erros = 0

    for (const cliente of elegíveis) {
      const tokenEnvio = (cliente as { instancia_id?: string | null }).instancia_id
      if (!tokenEnvio) continue

      // Seleciona mensagem aleatória se houver múltiplas variações
      let mensagemBase = regra.mensagem
      let variacaoIdx = 0
      try {
        const arr = JSON.parse(regra.mensagem)
        if (Array.isArray(arr) && arr.length > 0) {
          variacaoIdx = Math.floor(Math.random() * arr.length)
          mensagemBase = arr[variacaoIdx]
        }
      } catch { /* string simples, usa como está */ }

      const texto = mensagemBase
        .replace(/\{\{nome_cliente\}\}/gi, cliente.nome || 'Cliente')
        .replace(/\{\{nome\}\}/gi, cliente.nome || 'Cliente')
        .replace(/\{\{cidade\}\}/gi, cliente.cidade || '')

      try {
        const resp = await fetch(`${uazapiBase}/send/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: tokenEnvio },
          body: JSON.stringify({ number: cliente.telefone, text: texto }),
        })

        const httpStatus = resp.status
        const respBody = await resp.json().catch(() => ({}))

        if (resp.ok) {
          await Promise.all([
            supabase.from('mensagens_whatsapp').insert({
              numero_cliente: `${cliente.telefone}@s.whatsapp.net`,
              mensagem: texto,
              status: 'Processando',
              quem_mandou: 'Agente',
            }),
            supabase.from('remarketing_logs').insert({
              regra_id: regra.id,
              telefone: cliente.telefone,
              variacao: variacaoIdx,
              http_status: httpStatus,
            }),
            supabase.from('clientes').update({ status_atual: 'remarketing' }).eq('id', cliente.id),
          ])
          enviados++
        } else {
          await supabase.from('remarketing_logs').insert({
            regra_id: regra.id,
            telefone: cliente.telefone,
            variacao: variacaoIdx,
            http_status: httpStatus,
            erro: JSON.stringify(respBody),
          })
          erros++
        }
      } catch (e) {
        await supabase.from('remarketing_logs').insert({
          regra_id: regra.id,
          telefone: cliente.telefone,
          variacao: variacaoIdx,
          http_status: null,
          erro: e instanceof Error ? e.message : 'Erro desconhecido',
        })
        erros++
      }
    }

    resultados.push({ regra_id: regra.id, status_alvo: regra.status_alvo, enviados, erros })
  }

  const totalEnviados = resultados.reduce((sum, r) => sum + r.enviados, 0)
  return NextResponse.json({ ok: true, enviados: totalEnviados, detalhes: resultados })
}

// Permite chamada pelo cron (GET)
export async function GET() {
  return POST()
}
