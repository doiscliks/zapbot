// Helpers compartilhados para falar com a uazapi

// Normaliza a URL da uazapi para a base (protocolo + host), removendo paths como /send, /chat...
export function getUazapiBase(uazapiUrl: string): string {
  try {
    const u = new URL(uazapiUrl)
    return `${u.protocol}//${u.host}`
  } catch {
    return uazapiUrl.replace(/\/+$/, '').replace(/\/(send|group|chat|message|instance).*$/, '')
  }
}

// Busca a URL da foto de perfil do WhatsApp via /chat/GetNameAndImageURL.
// As URLs do WhatsApp expiram; quem exibe deve ter fallback (o Avatar tem).
export async function buscarFotoPerfil(uazapiBase: string, instanceToken: string, telefone: string): Promise<string | null> {
  try {
    const res = await fetch(`${uazapiBase}/chat/GetNameAndImageURL`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: instanceToken },
      body: JSON.stringify({ number: telefone, preview: true }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json() as Record<string, unknown>
    const url = (data.imagePreview as string) || (data.image as string) || ''
    return (typeof url === 'string' && url.startsWith('http')) ? url : null
  } catch {
    return null
  }
}
