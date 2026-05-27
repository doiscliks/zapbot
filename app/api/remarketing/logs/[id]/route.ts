import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase()
  const { id } = await params

  // Busca logs da regra
  const { data: logs, error } = await supabase
    .from('remarketing_logs')
    .select('telefone, enviado_em, variacao, http_status, erro')
    .eq('regra_id', id)
    .order('enviado_em', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!logs || logs.length === 0) return NextResponse.json([])

  // Busca nomes dos clientes pelos telefones
  const telefones = [...new Set(logs.map((l) => l.telefone))]
  const { data: clientes } = await supabase
    .from('clientes')
    .select('telefone, nome')
    .in('telefone', telefones)

  const nomesPorTelefone: Record<string, string> = {}
  for (const c of clientes ?? []) {
    if (c.telefone && !nomesPorTelefone[c.telefone]) {
      nomesPorTelefone[c.telefone] = c.nome
    }
  }

  const resultado = logs.map((l) => ({
    telefone: l.telefone,
    nome: nomesPorTelefone[l.telefone] || null,
    enviado_em: l.enviado_em,
    variacao: l.variacao ?? null,
    http_status: l.http_status ?? null,
    erro: l.erro ?? null,
  }))

  return NextResponse.json(resultado)
}
