import { supabase } from '@/lib/supabase'
import { GruposLink, GruposRotator, GruposRotatorComLinks } from '@/types'

export async function getRotators(): Promise<GruposRotatorComLinks[]> {
  const { data, error } = await supabase
    .from('grupos_rotators')
    .select('*, grupos_links(*)')
    .order('criado_em', { ascending: false })

  if (error) throw error

  return (data ?? []).map((r) => ({
    ...r,
    links: ((r.grupos_links ?? []) as GruposLink[]).sort(
      (a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime()
    ),
  }))
}

export async function criarRotator(nome: string): Promise<GruposRotator> {
  const slug = gerarSlug(nome)
  const { data, error } = await supabase
    .from('grupos_rotators')
    .insert({ nome, slug })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function renomearRotator(id: string, nome: string): Promise<void> {
  const { error } = await supabase
    .from('grupos_rotators')
    .update({ nome })
    .eq('id', id)

  if (error) throw error
}

export async function deletarRotator(id: string): Promise<void> {
  const { error } = await supabase.from('grupos_rotators').delete().eq('id', id)
  if (error) throw error
}

export async function adicionarLink(
  rotatorId: string,
  url: string,
  nome?: string,
  whatsappGroupId?: string
): Promise<GruposLink> {
  const { data, error } = await supabase
    .from('grupos_links')
    .insert({
      rotator_id: rotatorId,
      url,
      nome: nome?.trim() || null,
      whatsapp_group_id: whatsappGroupId?.trim() || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function atualizarGroupId(id: string, whatsappGroupId: string): Promise<void> {
  const { error } = await supabase
    .from('grupos_links')
    .update({ whatsapp_group_id: whatsappGroupId.trim() || null })
    .eq('id', id)

  if (error) throw error
}

export async function deletarLink(id: string): Promise<void> {
  const { error } = await supabase.from('grupos_links').delete().eq('id', id)
  if (error) throw error
}

export async function toggleLink(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('grupos_links').update({ ativo }).eq('id', id)
  if (error) throw error
}

function gerarSlug(nome: string): string {
  const base = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const sufixo = Math.random().toString(36).substring(2, 7)
  return `${base}-${sufixo}`
}
