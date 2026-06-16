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
    // O Google Meet aceita qualquer ID válido (alphanumério e hífens)
    const meetId = `zapbot-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

    // Constrói o link do Google Meet
    const meetLink = `https://meet.google.com/${meetId}`

    return meetLink
  } catch (error) {
    console.error('Erro ao gerar link do Google Meet:', error)
    return null
  }
}
