import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'
import { temPermissao, ehAdmin } from '@/lib/permissoes'
import { readTenantConfig, writeTenantConfig } from '@/lib/tenant-config'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

const MASKED = '••••••••••••••••••••••'

function mask(val: string): string {
  return val ? MASKED : ''
}

export async function GET(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await readTenantConfig(userId)

  const supabase = getSupabase()
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('telefone')
    .eq('id', userId)
    .maybeSingle()

  return NextResponse.json({
    telefone: usuario?.telefone ?? '',
    hasOpenaiKey: !!config.openaiKey,
    fbPixelId: config.fbPixelId,
    hasFbAccessToken: !!config.fbAccessToken,
    fbTestEventCode: config.fbTestEventCode,
    hasFbAdsToken: !!config.fbAdsToken,
    fbAdAccountId: config.fbAdAccountId,
    iaAtiva: config.iaAtiva,
    // masked versions for display
    openaiKey: mask(config.openaiKey),
    fbAccessToken: mask(config.fbAccessToken),
    fbAdsToken: mask(config.fbAdsToken),
  })
}

export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Este endpoint atende a tela Configurações (chaves) e o toggle de IA da tela
  // Treinamento. Exige a permissão da tela correspondente ao que está sendo alterado.
  const apenasIaAtiva = Object.keys(body).every((k) => k === 'iaAtiva')
  const autorizado = apenasIaAtiva ? await temPermissao(request, 'treinamento') : await ehAdmin(request)
  if (!autorizado) {
    return NextResponse.json({ error: 'Sem permissão para esta alteração' }, { status: 403 })
  }

  const current = await readTenantConfig(userId)

  function resolve(incoming: string | undefined, current: string): string {
    const val = incoming?.trim() ?? ''
    if (!val || val === MASKED) return current
    return val
  }

  try {
    await writeTenantConfig(userId, {
      openaiKey: resolve(body.openaiKey, current.openaiKey),
      fbPixelId: body.fbPixelId?.trim() ?? current.fbPixelId,
      fbAccessToken: resolve(body.fbAccessToken, current.fbAccessToken),
      fbTestEventCode: body.fbTestEventCode?.trim() ?? current.fbTestEventCode,
      fbAdsToken: resolve(body.fbAdsToken, current.fbAdsToken),
      fbAdAccountId: body.fbAdAccountId?.trim() ?? current.fbAdAccountId,
      ...(typeof body.iaAtiva === 'boolean' ? { iaAtiva: body.iaAtiva } : {}),
    })

    if (body.telefone !== undefined) {
      const supabase = getSupabase()
      await supabase
        .from('usuarios')
        .update({ telefone: body.telefone?.trim() || null })
        .eq('id', userId)
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao salvar configurações.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
