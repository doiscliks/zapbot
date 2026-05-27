import { NextRequest, NextResponse } from 'next/server'
import { readConfig } from '@/lib/config-server'
import { getTenantId } from '@/lib/tenant-auth'
import { readTenantConfig } from '@/lib/tenant-config'

export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  const [config, tenantConfig] = await Promise.all([
    readConfig(),
    userId ? readTenantConfig(userId) : Promise.resolve(null),
  ])

  const openaiKey = tenantConfig?.openaiKey || ''

  if (!openaiKey) {
    return NextResponse.json(
      { error: 'Chave da OpenAI não configurada. Acesse Configurações para adicionar sua chave.' },
      { status: 400 }
    )
  }

  const { pares } = await request.json() as {
    pares: { pergunta: string; resposta: string }[]
  }

  if (!pares || pares.length === 0) {
    return NextResponse.json({ error: 'Nenhum par enviado.' }, { status: 400 })
  }

  const paresTexto = pares
    .map((p, i) => `${i + 1}. P: ${p.pergunta}\n   R: ${p.resposta}`)
    .join('\n\n')

  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em criação de bases de conhecimento para agentes de atendimento no WhatsApp.

Sua tarefa é analisar pares brutos de conversas reais entre clientes e atendentes, e transformá-los em perguntas e respostas de alta qualidade para treinar um agente de IA.

Regras:
- Reescreva as perguntas de forma clara, genérica e reutilizável (sem nomes próprios ou dados específicos de pedidos)
- Reescreva as respostas de forma profissional, completa e natural — como um bom atendente responderia
- Elimine pares irrelevantes (saudações vazias, confirmações sem conteúdo, mensagens muito curtas)
- Agrupe perguntas similares em uma única entrada com a melhor resposta
- Mantenha o tom da empresa: atacado de moda, direto, simpático
- Retorne SOMENTE um JSON válido no formato: {"pares": [{"pergunta": "...", "resposta": "..."}]}
- Retorne entre 5 e 30 pares de alta qualidade`,
        },
        {
          role: 'user',
          content: `Analise os pares de conversas abaixo e gere uma base de conhecimento refinada:\n\n${paresTexto}`,
        },
      ],
    }),
  })

  if (!openaiRes.ok) {
    const err = await openaiRes.json()
    return NextResponse.json(
      { error: `Erro na OpenAI: ${err.error?.message ?? 'Erro desconhecido'}` },
      { status: 500 }
    )
  }

  const openaiData = await openaiRes.json()
  const content = openaiData.choices[0].message.content

  try {
    const parsed = JSON.parse(content)
    const paresRefinados = parsed.pares ?? []
    return NextResponse.json({
      pares: paresRefinados,
      tokens: openaiData.usage?.total_tokens ?? null,
    })
  } catch {
    return NextResponse.json(
      { error: 'Erro ao interpretar resposta da OpenAI.' },
      { status: 500 }
    )
  }
}
