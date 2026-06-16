function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

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
    // Gera um UUID v4 para a reunião
    // Google Meet aceita UUIDs padrão
    const meetId = generateUUID()

    // Constrói o link do Google Meet
    const meetLink = `https://meet.google.com/${meetId}`

    return meetLink
  } catch (error) {
    console.error('Erro ao gerar link do Google Meet:', error)
    return null
  }
}
