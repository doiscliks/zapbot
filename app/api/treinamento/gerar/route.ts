import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readConfig, getSupabaseEnv } from '@/lib/config-server'
import { getTenantId } from '@/lib/tenant-auth'
import { readTenantConfig } from '@/lib/tenant-config'

function getSupabase() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()
  return createClient(supabaseUrl, supabaseAnonKey)
}

export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [config, tenantConfig] = await Promise.all([
    readConfig(),
    readTenantConfig(userId),
  ])

  const openaiKey = tenantConfig.openaiKey

  if (!openaiKey) {
    return NextResponse.json(
      { error: 'Chave da OpenAI não configurada. Acesse Configurações para adicionar sua chave.' },
      { status: 400 }
    )
  }

  const supabase = getSupabase()

  const [promptRes, qaRes, textosRes] = await Promise.all([
    supabase.from('treinamento_prompt').select('conteudo').eq('user_id', userId).limit(1).single(),
    supabase.from('treinamento_qa').select('pergunta, resposta').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('treinamento_textos').select('titulo, conteudo').eq('user_id', userId).order('created_at', { ascending: true }),
  ])

  const prompt = promptRes.data?.conteudo ?? ''
  const qas = qaRes.data ?? []
  const textos = textosRes.data ?? []

  if (!prompt && qas.length === 0 && textos.length === 0) {
    return NextResponse.json(
      { error: 'Nenhum dado de treinamento encontrado. Adicione informações antes de gerar.' },
      { status: 400 }
    )
  }

  const secoes: string[] = []

  if (prompt) {
    secoes.push(`## Instruções e Personalidade do Agente\n${prompt}`)
  }

  if (qas.length > 0) {
    const qaTexto = qas
      .map((qa: { pergunta: string; resposta: string }) => `P: ${qa.pergunta}\nR: ${qa.resposta}`)
      .join('\n\n')
    secoes.push(`## Perguntas e Respostas\n${qaTexto}`)
  }

  if (textos.length > 0) {
    const textosTexto = textos
      .map((t: { titulo: string; conteudo: string }) => `### ${t.titulo}\n${t.conteudo}`)
      .join('\n\n')
    secoes.push(`## Base de Conhecimento\n${textosTexto}`)
  }

  const conteudoInput = secoes.join('\n\n---\n\n')

  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'Você é um especialista em criação de bases de conhecimento para agentes de IA conversacionais. Sua tarefa é organizar e consolidar informações de treinamento em um único bloco coeso, claro e bem estruturado.',
        },
        {
          role: 'user',
          content: `Com base nas informações de treinamento abaixo, crie um único bloco de conhecimento consolidado. Este bloco será usado como contexto do sistema para um agente que responde mensagens de WhatsApp. Organize as informações de forma lógica, elimine redundâncias, mantenha todas as instruções de personalidade e comportamento, e garanta que o agente tenha tudo que precisa para responder adequadamente.\n\n${conteudoInput}`,
        },
      ],
      temperature: 0.3,
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
  const blocoGerado: string = openaiData.choices[0].message.content
  const usage = openaiData.usage

  const { data: saved, error: saveError } = await supabase
    .from('base_conhecimento')
    .insert({
      conteudo: blocoGerado,
      tokens_prompt: usage?.prompt_tokens ?? null,
      tokens_resposta: usage?.completion_tokens ?? null,
      tokens_total: usage?.total_tokens ?? null,
      user_id: userId,
    })
    .select()
    .single()

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, base: saved })
}
