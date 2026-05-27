'use client'

import { supabase } from './supabase'

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) return null
  return data.session
}

export async function signOut() {
  await supabase.auth.signOut()
}
