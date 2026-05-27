import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseEnv } from '@/lib/config-server'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()
  return createClient(supabaseUrl, supabaseAnonKey)
}

function extrairTexto(mensagem: string): string | null {
  if (!mensagem) return null
  const texto = mensagem.trim()

  // Tenta parsear como JSON (formato UAZAPI)
  if (texto.startsWith('{')) {
    try {
      const obj = JSON.parse(texto)
      const t = obj?.text?.trim() || obj?.caption?.trim() || null
      return t
    } catch {
      return null
    }
  }

  return texto
}

const FRASES_AUTOMATICAS = [
  'O pagamento do seu pedido',
  'Recebemos seu pedido',
  'Notei que você separou algumas peças',
  'Este é o código de rastreio',
  'Olá,',
  '#fz',
  'jratacadoofc.com.br',
]

function ehMensagemAutomatica(texto: string): boolean {
  return FRASES_AUTOMATICAS.some((f) => texto.includes(f))
}

// GET — extrai pares pergunta/resposta de mensagens_whatsapp
export async function GET(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = getSupabase()

  const { data: mensagens, error } = await supabase
    .from('mensagens_whatsapp')
    .select('id, numero_cliente, mensagem, quem_mandou, data_criacao')
    .eq('user_id', userId)
    .order('numero_cliente', { ascending: true })
    .order('data_criacao', { ascending: true })
    .limit(2000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!mensagens || mensagens.length === 0) return NextResponse.json([])

  // Agrupa por numero_cliente
  const porCliente: Record<string, typeof mensagens> = {}
  for (const m of mensagens) {
    if (!porCliente[m.numero_cliente]) porCliente[m.numero_cliente] = []
    porCliente[m.numero_cliente].push(m)
  }

  const pares: { pergunta: string; resposta: string; prioridade: number }[] = []

  for (const conversa of Object.values(porCliente)) {
    for (let i = 0; i < conversa.length - 1; i++) {
      const atual = conversa[i]
      const proxima = conversa[i + 1]

      const ehCliente = (v: string) => v === 'cliente'
      const ehResposta = (v: string) => v === 'agente' || v === 'manual'

      // Par: cliente pergunta → agente ou manual responde
      if (ehCliente(atual.quem_mandou) && ehResposta(proxima.quem_mandou)) {
        const pergunta = extrairTexto(atual.mensagem)
        const resposta = extrairTexto(proxima.mensagem)

        if (
          pergunta && resposta &&
          pergunta.length > 5 && resposta.length > 5 &&
          !pergunta.startsWith('http') && !resposta.startsWith('http') &&
          !ehMensagemAutomatica(pergunta) && !ehMensagemAutomatica(resposta)
        ) {
          pares.push({ pergunta, resposta, prioridade: proxima.quem_mandou === 'manual' ? 2 : 1 })
        }
      }
    }
  }

  // Ordena: manual primeiro, depois agente
  pares.sort((a, b) => b.prioridade - a.prioridade)

  // Remove duplicatas por pergunta similar (exact match)
  const vistos = new Set<string>()
  const paresFiltrados = pares.filter((p) => {
    const chave = p.pergunta.toLowerCase().slice(0, 60)
    if (vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })

  return NextResponse.json(
    paresFiltrados.slice(0, 100).map(({ pergunta, resposta }) => ({ pergunta, resposta }))
  )
}

// POST — importa pares selecionados para treinamento_qa
export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()
  const { pares } = await request.json() as { pares: { pergunta: string; resposta: string }[] }

  if (!pares || pares.length === 0) {
    return NextResponse.json({ error: 'Nenhum par selecionado' }, { status: 400 })
  }

  const { error } = await supabase
    .from('treinamento_qa')
    .insert(pares.map((p) => ({ pergunta: p.pergunta.trim(), resposta: p.resposta.trim(), user_id: userId })))

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, importados: pares.length })
}
