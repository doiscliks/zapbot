import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'
import { temPermissao, SCREEN_KEYS } from '@/lib/permissoes'
import { hashPassword } from '@/lib/password'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

function getSupabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '')
}

function normalizarPermissoes(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.filter((k): k is string => typeof k === 'string' && SCREEN_KEYS.includes(k))
}

export async function GET(request: NextRequest) {
  const ownerId = getTenantId(request)
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await temPermissao(request, 'usuarios'))) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, telefone, permissoes, ativo, is_attendant, usado_em')
    .eq('parent_id', ownerId)
    .order('nome', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const ownerId = getTenantId(request)
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await temPermissao(request, 'usuarios'))) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await request.json()
  const nome = (body.nome || '').trim()
  const email = (body.email || '').trim().toLowerCase()
  const senha = body.senha || ''
  const telefone = (body.telefone || '').trim() || null
  const permissoes = normalizarPermissoes(body.permissoes)

  if (!nome || !email || !senha) {
    return NextResponse.json({ error: 'Nome, email e senha são obrigatórios' }, { status: 400 })
  }
  if (senha.length < 6) {
    return NextResponse.json({ error: 'A senha deve ter ao menos 6 caracteres' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Email já usado?
  const { data: existente } = await supabase.from('usuarios').select('id').eq('email', email).maybeSingle()
  if (existente) return NextResponse.json({ error: 'Já existe um usuário com este email' }, { status: 409 })

  // Herda a validade da conta-mãe
  const { data: owner } = await supabase.from('usuarios').select('validade').eq('id', ownerId).single()

  const senha_hash = await hashPassword(senha)

  // Cria usuário no Supabase Auth também
  const supabaseAdmin = getSupabaseAdmin()
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  })

  if (authError) {
    return NextResponse.json({ error: `Erro ao criar conta de autenticação: ${authError.message}` }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('usuarios')
    .insert({
      id: authUser?.user?.id,
      nome,
      email,
      senha_hash,
      telefone,
      permissoes,
      parent_id: ownerId,
      ativo: true,
      is_attendant: body.is_attendant ?? false,
      validade: owner?.validade ?? null,
    })
    .select('id, nome, email, telefone, permissoes, ativo, is_attendant, usado_em')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Gera slug automático baseado no primeiro nome
  const primeiroNome = nome.split(' ')[0].toLowerCase()
  const slug = primeiroNome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')

  // Verifica se slug já existe, se sim adiciona número
  let slugFinal = slug
  let contador = 2
  while (true) {
    const { count } = await supabase
      .from('agenda_config')
      .select('*', { count: 'exact', head: true })
      .eq('slug', slugFinal)

    if (count === 0) break
    slugFinal = `${slug}${contador}`
    contador++
  }

  // Cria agenda_config para o novo usuário
  const { error: configError } = await supabase
    .from('agenda_config')
    .insert({
      user_id: data.id,
      slug: slugFinal,
      titulo: `Agendamento de ${nome}`,
      duracao_minutos: 30,
      ativo: true,
    })

  if (configError) {
    console.warn('[USUARIOS] Erro ao criar agenda_config:', configError.message)
  }

  return NextResponse.json(data)
}
