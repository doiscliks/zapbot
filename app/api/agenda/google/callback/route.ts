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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zapbot-orcin.vercel.app'

  if (error || !code || !userId) {
    return NextResponse.redirect(`${appUrl}/agenda/config?google=erro`)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
  const redirectUri = `${appUrl}/api/agenda/google/callback`

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
    return NextResponse.redirect(`${appUrl}/agenda/config?google=erro`)
  }

  const supabase = getSupabase()
  await supabase
    .from('agenda_config')
    .update({
      google_access_token: tokens.access_token,
      google_refresh_token: tokens.refresh_token || null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return NextResponse.redirect(`${appUrl}/agenda/config?google=ok`)
}
