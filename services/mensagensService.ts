import { supabase } from '@/lib/supabase'
import { MensagemWhatsapp } from '@/types'

export async function getMensagensByTelefone(telefone: string): Promise<MensagemWhatsapp[]> {
  // Normaliza para buscar tanto com quanto sem @s.whatsapp.net
  const telefoneSemSufixo = telefone.split('@')[0]

  const filtro = telefoneSemSufixo === telefone
    ? `numero_cliente.eq.${telefone}`
    : `numero_cliente.eq.${telefone},numero_cliente.eq.${telefoneSemSufixo}`

  const { data, error } = await supabase
    .from('mensagens_whatsapp')
    .select('*')
    .or(filtro)
    .order('data_criacao', { ascending: true })

  if (error) throw error
  return data ?? []
}
