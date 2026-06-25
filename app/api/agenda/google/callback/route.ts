import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')
  const error = searchParams.get('error')

  // Fixo: precisa ser idêntico ao domínio usado em /api/agenda/google/auth e cadastrado no Google Cloud Console.
  const appUrl = 'https://zapbot-2cliks.vercel.app'

  if (error || !code || !userId) {
    const msg = encodeURIComponent(error || (!code ? 'sem_code' : 'sem_userId'))
    return NextResponse.redirect(`${appUrl}/agenda/config?google=erro&msg=${msg}`)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
  const redirectUri = 'https://zapbot-2cliks.vercel.app/api/agenda/google/callback'

  // Troca o code pelos tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()

  if (!tokens.access_token) {
    const msg = encodeURIComponent(tokens.error_description || tokens.error || 'token_failed')
    return NextResponse.redirect(`${appUrl}/agenda/config?google=erro&msg=${msg}`)
  }

  const supabase = getSupabase()

  // Atualiza apenas os tokens — nunca toca no slug ou outras configurações
  const { error: updateError, data: updateData } = await supabase
    .from('agenda_config')
    .update({
      google_access_token: tokens.access_token,
      google_refresh_token: tokens.refresh_token || null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()

  console.log('[GOOGLE_CALLBACK] Update result:', { userId, updateError, updateDataCount: updateData?.length })

  if (updateError) {
    const msg = encodeURIComponent(`update_error: ${updateError.message}`)
    return NextResponse.redirect(`${appUrl}/agenda/config?google=erro&msg=${msg}`)
  }

  if (!updateData || updateData.length === 0) {
    console.log('[GOOGLE_CALLBACK] AVISO: nenhuma config encontrada para atualizar!', { userId })
    const msg = encodeURIComponent('nenhuma_config_encontrada')
    return NextResponse.redirect(`${appUrl}/agenda/config?google=erro&msg=${msg}`)
  }

  return NextResponse.redirect(`${appUrl}/agenda/config?google=ok`)
}
