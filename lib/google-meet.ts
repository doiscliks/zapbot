export async function gerarLinkMeet(
  titulo: string,
  dataHoraInicio: Date,
  dataHoraFim: Date,
  nomeCliente: string,
  emailCliente?: string,
  telefoneCliente?: string,
  assuntoCliente?: string
): Promise<string | null> {
  try {
    // Gera um ID único para a reunião do Google Meet
    // Google Meet aceita apenas letras minúsculas e números (sem hífens)
    const timestamp = Date.now().toString().slice(-8) // últimos 8 dígitos
    const random = Math.random().toString(36).substring(2, 10) // caracteres aleatórios
    const meetId = `zapbot${timestamp}${random}`

    // Constrói o link do Google Meet
    const meetLink = `https://meet.google.com/${meetId}`

    return meetLink
  } catch (error) {
    console.error('Erro ao gerar link do Google Meet:', error)
    return null
  }
}
