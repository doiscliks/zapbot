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
    // Gera um ID único sem hífens (apenas caracteres hexadecimais)
    const timestamp = Date.now().toString(16)
    const random = Math.random().toString(16).substring(2)
    const meetId = `${timestamp}${random}`.substring(0, 25)

    // Constrói o link do Google Meet
    const meetLink = `https://meet.google.com/${meetId}`

    return meetLink
  } catch (error) {
    console.error('Erro ao gerar link do Google Meet:', error)
    return null
  }
}
