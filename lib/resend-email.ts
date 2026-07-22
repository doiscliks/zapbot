import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function enviarEmailConfirmacaoAgendamento(
  emailCliente: string,
  nomeCliente: string,
  dataHoraInicio: Date,
  duracao: number,
  telefoneCliente: string,
  assunto?: string,
  meetLink?: string
): Promise<boolean> {
  try {
    console.log('[EMAIL] Iniciando envio para:', emailCliente)

    if (!emailCliente) {
      console.log('[EMAIL] Email do cliente não fornecido')
      return false
    }

    console.log('[EMAIL] API Key presente?', !!process.env.RESEND_API_KEY)

    const dataFormatada = dataHoraInicio.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    })

    const horaFormatada = dataHoraInicio.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
      hour12: false,
    })

    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
      <div style="background-color: white; border-radius: 12px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; background: var(--brand-gradient); color: white; width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">
            2C
          </div>
        </div>

        <h1 style="color: #1f2937; text-align: center; margin: 0 0 10px 0; font-size: 28px;">
          Agendamento Confirmado! ✅
        </h1>

        <p style="color: #6b7280; text-align: center; margin: 0 0 30px 0; font-size: 16px;">
          Olá ${nomeCliente}, seu agendamento foi confirmado com sucesso.
        </p>

        <div style="background-color: #f0fafb; border-left: 4px solid #12c6d6; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
          <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 18px;">Detalhes do Agendamento</h2>

          <div style="margin-bottom: 12px;">
            <span style="color: #6b7280; font-size: 14px;">📅 Data:</span>
            <p style="color: #1f2937; margin: 5px 0 0 0; font-weight: 600; font-size: 16px;">${dataFormatada}</p>
          </div>

          <div style="margin-bottom: 12px;">
            <span style="color: #6b7280; font-size: 14px;">⏰ Horário:</span>
            <p style="color: #1f2937; margin: 5px 0 0 0; font-weight: 600; font-size: 16px;">${horaFormatada}</p>
          </div>

          <div style="margin-bottom: 12px;">
            <span style="color: #6b7280; font-size: 14px;">⏱ Duração:</span>
            <p style="color: #1f2937; margin: 5px 0 0 0; font-weight: 600; font-size: 16px;">${duracao} minutos</p>
          </div>

          ${assunto ? `
          <div style="margin-bottom: 12px;">
            <span style="color: #6b7280; font-size: 14px;">📋 Assunto:</span>
            <p style="color: #1f2937; margin: 5px 0 0 0; font-weight: 600; font-size: 16px;">${assunto}</p>
          </div>
          ` : ''}

          ${meetLink ? `
          <div style="margin-bottom: 0;">
            <span style="color: #6b7280; font-size: 14px;">🎥 Google Meet:</span>
            <p style="color: #1f2937; margin: 5px 0 0 0; font-weight: 600; font-size: 16px;">
              <a href="${meetLink}" style="color: #12c6d6; text-decoration: none; word-break: break-all;">
                ${meetLink}
              </a>
            </p>
          </div>
          ` : ''}
        </div>

        <p style="color: #6b7280; font-size: 14px; margin-bottom: 5px;">
          <strong>Contato:</strong> ${telefoneCliente}
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
          Este é um email automático. Não responda diretamente.
        </p>
      </div>
    </div>
    `

    console.log('[EMAIL] Enviando para:', emailCliente)
    console.log('[EMAIL] API Key presente?', !!process.env.RESEND_API_KEY)

    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: emailCliente,
      subject: `Agendamento Confirmado - ${dataFormatada}`,
      html: htmlContent,
    })

    console.log('[EMAIL] Resposta status:', result.data ? 'sucesso' : 'erro')
    console.log('[EMAIL] Resposta completa:', JSON.stringify(result))

    if (result.error) {
      console.error('[EMAIL] Erro Resend:', result.error)
      return false
    }

    console.log('[EMAIL] Enviado! ID:', result.data?.id)
    return !!result.data?.id
  } catch (error) {
    console.error('Erro ao enviar email:', error)
    return false
  }
}
