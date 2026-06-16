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
    // Gera um ID único com caracteres alfanuméricos (Google Meet requer letras + números)
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    const timestamp = Date.now().toString(36)
    let random = ''
    for (let i = 0; i < 15; i++) {
      random += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    const meetId = `${timestamp}${random}`.substring(0, 25)

    // Constrói o link do Google Meet
    const meetLink = `https://meet.google.com/${meetId}`

    return meetLink
  } catch (error) {
    console.error('Erro ao gerar link do Google Meet:', error)
    return null
  }
}
