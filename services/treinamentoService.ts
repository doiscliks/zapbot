import { supabase } from '@/lib/supabase'
import { TreinamentoPrompt, TreinamentoQA, TreinamentoTexto, BaseConhecimento } from '@/types'

// --- Prompt ---

export async function getPrompt(): Promise<TreinamentoPrompt | null> {
  const { data, error } = await supabase
    .from('treinamento_prompt')
    .select('*')
    .limit(1)
    .single()
  if (error) return null
  return data
}

export async function upsertPrompt(conteudo: string): Promise<void> {
  const existing = await getPrompt()
  if (existing) {
    const { error } = await supabase
      .from('treinamento_prompt')
      .update({ conteudo, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('treinamento_prompt')
      .insert({ conteudo })
    if (error) throw error
  }
}

// --- Q&A ---

export async function getQAs(): Promise<TreinamentoQA[]> {
  const { data, error } = await supabase
    .from('treinamento_qa')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createQA(pergunta: string, resposta: string): Promise<TreinamentoQA> {
  const { data, error } = await supabase
    .from('treinamento_qa')
    .insert({ pergunta, resposta })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteQA(id: number): Promise<void> {
  const { error } = await supabase.from('treinamento_qa').delete().eq('id', id)
  if (error) throw error
}

// --- Textos ---

export async function getTextos(): Promise<TreinamentoTexto[]> {
  const { data, error } = await supabase
    .from('treinamento_textos')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createTexto(titulo: string, conteudo: string): Promise<TreinamentoTexto> {
  const { data, error } = await supabase
    .from('treinamento_textos')
    .insert({ titulo, conteudo })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTexto(id: number): Promise<void> {
  const { error } = await supabase.from('treinamento_textos').delete().eq('id', id)
  if (error) throw error
}

// --- Base de Conhecimento ---

export async function getBaseConhecimento(): Promise<BaseConhecimento | null> {
  const { data, error } = await supabase
    .from('base_conhecimento')
    .select('*')
    .order('gerado_em', { ascending: false })
    .limit(1)
    .single()
  if (error) return null
  return data
}
