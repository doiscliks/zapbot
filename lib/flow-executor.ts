import { readConfig } from '@/lib/config-server'
import { readTenantConfig } from '@/lib/tenant-config'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any

interface ExecParams {
  userId: string
  instanciaToken: string
  uazapiBase: string
  openaiKey: string
}

type NodeData = Record<string, unknown>

function interpolate(text: string, vars: Record<string, string>): string {
  return (text || '').replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
}

async function sendWhatsApp(params: ExecParams, phone: string, text: string) {
  if (!params.uazapiBase || !params.instanciaToken || !text) return
  await fetch(`${params.uazapiBase}/send/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: params.instanciaToken },
    body: JSON.stringify({ number: phone, text }),
  }).catch(() => {})
}

async function sendMedia(
  params: ExecParams,
  phone: string,
  type: string,
  file: string,
  caption?: string,
  docName?: string,
) {
  if (!params.uazapiBase || !params.instanciaToken || !file) return
  const body: Record<string, unknown> = { number: phone, type, file }
  if (caption) body.text = caption
  if (docName) body.docName = docName
  await fetch(`${params.uazapiBase}/send/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: params.instanciaToken },
    body: JSON.stringify(body),
  }).catch(() => {})
}

function evaluateCondition(data: NodeData, vars: Record<string, string>): boolean {
  const field = (data.field as string) || ''
  const operator = (data.operator as string) || 'igual'
  const expected = String(data.value ?? '')
  const actual = String(vars[field] ?? '')

  switch (operator) {
    case 'igual': return actual.toLowerCase() === expected.toLowerCase()
    case 'diferente': return actual.toLowerCase() !== expected.toLowerCase()
    case 'contém': return actual.toLowerCase().includes(expected.toLowerCase())
    case 'maior_que': return Number(actual) > Number(expected)
    case 'menor_que': return Number(actual) < Number(expected)
    case 'existe': return actual !== '' && actual !== 'undefined'
    case 'nao_existe': return actual === '' || actual === 'undefined'
    default: return false
  }
}

function getNextNodeId(edges: Record<string, unknown>[], nodeId: string, handle?: string): string | null {
  const edge = edges.find(e =>
    e.source_node_id === nodeId && (handle ? e.source_handle === handle : true)
  )
  return (edge?.target_node_id as string) ?? null
}

async function logStep(
  supabase: Supabase, executionId: string, nodeId: string, nodeType: string,
  input: unknown, output: unknown, status = 'completed'
) {
  await supabase.from('flow_execution_steps').insert({
    execution_id: executionId,
    node_id: nodeId,
    node_type: nodeType,
    input,
    output,
    status,
  }).catch(() => {})
}

async function executeNode(
  supabase: Supabase,
  execution: Record<string, unknown>,
  node: Record<string, unknown>,
  nodes: Record<string, unknown>[],
  edges: Record<string, unknown>[],
  inputText: string,
  params: ExecParams,
): Promise<{ nextNodeId: string | null; waitForInput: boolean; done: boolean; resumeAt?: string }> {
  const data = (node.data ?? {}) as NodeData
  const nodeType = (node.type as string) || 'message'
  const execId = execution.id as string
  const phone = execution.phone as string
  const vars = (execution.variables ?? {}) as Record<string, string>

  switch (nodeType) {
    case 'start': {
      await logStep(supabase, execId, node.id as string, nodeType, {}, { started: true })
      return { nextNodeId: getNextNodeId(edges, node.id as string), waitForInput: false, done: false }
    }

    case 'message': {
      const delay = Number(data.delay_seconds ?? 0)
      if (delay > 0) await new Promise(r => setTimeout(r, Math.min(delay * 1000, 8000)))
      const text = interpolate(data.text as string, vars)
      await sendWhatsApp(params, phone, text)
      await logStep(supabase, execId, node.id as string, nodeType, { text }, { sent: true })
      return { nextNodeId: getNextNodeId(edges, node.id as string), waitForInput: false, done: false }
    }

    case 'question': {
      const text = interpolate(data.text as string, vars)
      await sendWhatsApp(params, phone, text)
      await logStep(supabase, execId, node.id as string, nodeType, { text }, { waiting: true })
      return { nextNodeId: null, waitForInput: true, done: false }
    }

    case 'condition': {
      const result = evaluateCondition(data, vars)
      const handle = result ? 'true' : 'false'
      await logStep(supabase, execId, node.id as string, nodeType, { data, vars }, { result, handle })
      return { nextNodeId: getNextNodeId(edges, node.id as string, handle), waitForInput: false, done: false }
    }

    case 'ai_agent': {
      if (!params.openaiKey) {
        await logStep(supabase, execId, node.id as string, nodeType, {}, { error: 'no openai key' }, 'error')
        return { nextNodeId: getNextNodeId(edges, node.id as string), waitForInput: false, done: false }
      }
      const prompt = interpolate(data.prompt as string, vars)
      const limit = Number(data.message_limit ?? 5)
      try {
        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${params.openaiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: prompt },
              { role: 'user', content: inputText || 'Olá' },
            ],
            max_tokens: 500,
            temperature: 0.7,
          }),
        })
        if (aiRes.ok) {
          const aiData = await aiRes.json()
          const reply = (aiData.choices?.[0]?.message?.content as string || '').trim()
          if (reply) await sendWhatsApp(params, phone, reply)

          const msgCount = Number(vars.__ai_msg_count ?? 0) + 1
          await supabase.from('flow_executions').update({ variables: { ...vars, __ai_msg_count: String(msgCount) } }).eq('id', execId)

          if (msgCount < limit) {
            await logStep(supabase, execId, node.id as string, nodeType, { inputText }, { reply, msgCount })
            return { nextNodeId: null, waitForInput: true, done: false }
          }
          if (data.transfer_to_human) {
            await supabase.from('clientes').update({ ia_desabilitada: true }).eq('telefone', phone).eq('user_id', params.userId)
          }
        }
      } catch { /* ignora */ }
      await logStep(supabase, execId, node.id as string, nodeType, {}, { done: true })
      return { nextNodeId: getNextNodeId(edges, node.id as string), waitForInput: false, done: false }
    }

    case 'delay': {
      const unitMap: Record<string, number> = { segundos: 1, minutos: 60, horas: 3600, dias: 86400 }
      const seconds = Number(data.time ?? 1) * (unitMap[data.unit as string] ?? 60)
      const resumeAt = new Date(Date.now() + seconds * 1000).toISOString()
      await logStep(supabase, execId, node.id as string, nodeType, { seconds }, { resumeAt })
      return { nextNodeId: getNextNodeId(edges, node.id as string), waitForInput: false, done: false, resumeAt }
    }

    case 'update_crm': {
      const updates: Record<string, unknown> = {}
      if (data.status) updates.status_atual = interpolate(data.status as string, vars)
      if (data.responsible) updates.responsavel = interpolate(data.responsible as string, vars)
      if (Object.keys(updates).length > 0) {
        await supabase.from('clientes').update(updates).eq('telefone', phone).eq('user_id', params.userId)
      }
      await logStep(supabase, execId, node.id as string, nodeType, data, { updated: updates })
      return { nextNodeId: getNextNodeId(edges, node.id as string), waitForInput: false, done: false }
    }

    case 'human_transfer': {
      await supabase.from('clientes').update({ ia_desabilitada: true, status_atual: 'humano' }).eq('telefone', phone).eq('user_id', params.userId)
      if (data.internal_message) {
        const msg = interpolate(data.internal_message as string, vars)
        await sendWhatsApp(params, phone, msg)
      }
      await logStep(supabase, execId, node.id as string, nodeType, data, { transferred: true })
      return { nextNodeId: null, waitForInput: false, done: true }
    }

    case 'webhook': {
      try {
        const url = interpolate(data.url as string, vars)
        const method = (data.method as string) || 'POST'
        const headers = JSON.parse(interpolate(data.headers as string || '{}', vars))
        const body = method !== 'GET' ? interpolate(data.body as string || '{}', vars) : undefined
        const wRes = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body })
        const wData = await wRes.json().catch(() => ({}))
        if (typeof wData === 'object' && wData !== null) {
          const newVars = { ...vars }
          for (const [k, v] of Object.entries(wData)) { newVars[k] = String(v) }
          await supabase.from('flow_executions').update({ variables: newVars }).eq('id', execId)
        }
        await logStep(supabase, execId, node.id as string, nodeType, { url, method }, { status: wRes.status, data: wData })
      } catch (e) {
        await logStep(supabase, execId, node.id as string, nodeType, {}, { error: String(e) }, 'error')
      }
      return { nextNodeId: getNextNodeId(edges, node.id as string), waitForInput: false, done: false }
    }

    case 'end': {
      if (data.final_message) {
        const msg = interpolate(data.final_message as string, vars)
        await sendWhatsApp(params, phone, msg)
      }
      if (data.final_status) {
        await supabase.from('clientes').update({ status_atual: data.final_status }).eq('telefone', phone).eq('user_id', params.userId)
      }
      await logStep(supabase, execId, node.id as string, nodeType, {}, { finished: true })
      return { nextNodeId: null, waitForInput: false, done: true }
    }

    case 'send_image': {
      await sendMedia(params, phone, 'image', interpolate(data.media_url as string, vars), data.caption ? interpolate(data.caption as string, vars) : undefined)
      await logStep(supabase, execId, node.id as string, nodeType, { url: data.media_url }, { sent: true })
      return { nextNodeId: getNextNodeId(edges, node.id as string), waitForInput: false, done: false }
    }

    case 'send_audio': {
      await sendMedia(params, phone, 'audio', interpolate(data.media_url as string, vars))
      await logStep(supabase, execId, node.id as string, nodeType, { url: data.media_url }, { sent: true })
      return { nextNodeId: getNextNodeId(edges, node.id as string), waitForInput: false, done: false }
    }

    case 'send_video': {
      await sendMedia(params, phone, 'video', interpolate(data.media_url as string, vars), data.caption ? interpolate(data.caption as string, vars) : undefined)
      await logStep(supabase, execId, node.id as string, nodeType, { url: data.media_url }, { sent: true })
      return { nextNodeId: getNextNodeId(edges, node.id as string), waitForInput: false, done: false }
    }

    case 'send_document': {
      await sendMedia(params, phone, 'document', interpolate(data.media_url as string, vars), undefined, data.filename ? interpolate(data.filename as string, vars) : undefined)
      await logStep(supabase, execId, node.id as string, nodeType, { url: data.media_url }, { sent: true })
      return { nextNodeId: getNextNodeId(edges, node.id as string), waitForInput: false, done: false }
    }

    case 'add_tag': {
      const tag = interpolate(data.tag as string, vars)
      if (tag) {
        const { data: lead } = await supabase.from('clientes').select('etiquetas').eq('telefone', phone).eq('user_id', params.userId).maybeSingle()
        const etiquetas: string[] = (lead?.etiquetas ?? [])
        if (!etiquetas.includes(tag)) {
          await supabase.from('clientes').update({ etiquetas: [...etiquetas, tag] }).eq('telefone', phone).eq('user_id', params.userId)
        }
      }
      await logStep(supabase, execId, node.id as string, nodeType, { tag }, { added: true })
      return { nextNodeId: getNextNodeId(edges, node.id as string), waitForInput: false, done: false }
    }

    case 'remove_tag': {
      const tag = interpolate(data.tag as string, vars)
      if (tag) {
        const { data: lead } = await supabase.from('clientes').select('etiquetas').eq('telefone', phone).eq('user_id', params.userId).maybeSingle()
        const etiquetas: string[] = (lead?.etiquetas ?? []).filter((t: string) => t !== tag)
        await supabase.from('clientes').update({ etiquetas }).eq('telefone', phone).eq('user_id', params.userId)
      }
      await logStep(supabase, execId, node.id as string, nodeType, { tag }, { removed: true })
      return { nextNodeId: getNextNodeId(edges, node.id as string), waitForInput: false, done: false }
    }

    case 'check_keyword': {
      const keywords = (data.keywords as string || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
      const matchType = (data.match_type as string) || 'contém'
      const input = inputText.toLowerCase()
      let matched = false
      if (matchType === 'igual') matched = keywords.some(k => input === k)
      else if (matchType === 'começa_com') matched = keywords.some(k => input.startsWith(k))
      else matched = keywords.some(k => input.includes(k))
      const handle = matched ? 'true' : 'false'
      await logStep(supabase, execId, node.id as string, nodeType, { keywords, input }, { matched, handle })
      return { nextNodeId: getNextNodeId(edges, node.id as string, handle), waitForInput: false, done: false }
    }

    case 'check_status': {
      const expectedStatus = interpolate(data.status as string, vars).toLowerCase()
      const { data: lead } = await supabase.from('clientes').select('status_atual').eq('telefone', phone).eq('user_id', params.userId).maybeSingle()
      const currentStatus = (lead?.status_atual ?? '').toLowerCase()
      const matched = currentStatus === expectedStatus
      const handle = matched ? 'true' : 'false'
      await logStep(supabase, execId, node.id as string, nodeType, { expectedStatus, currentStatus }, { matched, handle })
      return { nextNodeId: getNextNodeId(edges, node.id as string, handle), waitForInput: false, done: false }
    }

    case 'check_response': {
      // Se chegou aqui, o contato respondeu — saída "Sim"
      await logStep(supabase, execId, node.id as string, nodeType, {}, { responded: true })
      return { nextNodeId: getNextNodeId(edges, node.id as string, 'true'), waitForInput: false, done: false }
    }

    default:
      return { nextNodeId: getNextNodeId(edges, node.id as string), waitForInput: false, done: false }
  }
}

async function runExecution(
  supabase: Supabase,
  execution: Record<string, unknown>,
  nodes: Record<string, unknown>[],
  edges: Record<string, unknown>[],
  startNodeId: string,
  inputText: string,
  params: ExecParams,
) {
  let currentNodeId: string | null = startNodeId
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id as string, n]))
  let maxSteps = 30

  while (currentNodeId && maxSteps-- > 0) {
    const node = nodeMap[currentNodeId]
    if (!node) break

    const result = await executeNode(supabase, execution, node, nodes, edges, inputText, params)

    if (result.resumeAt) {
      await supabase.from('flow_executions').update({
        current_node_id: result.nextNodeId,
        status: 'delayed',
        resume_at: result.resumeAt,
        updated_at: new Date().toISOString(),
      }).eq('id', execution.id)
      return
    }

    if (result.waitForInput) {
      await supabase.from('flow_executions').update({
        current_node_id: currentNodeId,
        status: 'waiting_response',
        updated_at: new Date().toISOString(),
      }).eq('id', execution.id)
      return
    }

    if (result.done || !result.nextNodeId) {
      await supabase.from('flow_executions').update({
        status: 'completed',
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', execution.id)
      return
    }

    currentNodeId = result.nextNodeId
    inputText = ''
  }

  await supabase.from('flow_executions').update({
    status: 'completed',
    finished_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', execution.id)
}

export async function startFlowExecution(
  supabase: Supabase,
  flow: Record<string, unknown>,
  leadId: number | null,
  phone: string,
  inputText: string,
  params: ExecParams,
): Promise<{ executionId: string }> {
  const [nodesRes, edgesRes] = await Promise.all([
    supabase.from('flow_nodes').select('*').eq('flow_id', flow.id),
    supabase.from('flow_edges').select('*').eq('flow_id', flow.id),
  ])

  const nodes = nodesRes.data ?? []
  const edges = edgesRes.data ?? []
  const startNode = nodes.find((n: Record<string, unknown>) => n.type === 'start')
  if (!startNode) return { executionId: '' }

  const { data: exec } = await supabase.from('flow_executions').insert({
    flow_id: flow.id,
    lead_id: leadId,
    phone,
    current_node_id: startNode.id,
    status: 'running',
    variables: {},
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select('id').single()

  if (!exec) return { executionId: '' }

  const execution = { id: exec.id, flow_id: flow.id, phone, variables: {} }
  await runExecution(supabase, execution, nodes, edges, startNode.id as string, inputText, params)
  return { executionId: exec.id }
}

export async function continueExecution(
  supabase: Supabase,
  exec: Record<string, unknown>,
  inputText: string,
  params: ExecParams,
) {
  const [nodesRes, edgesRes] = await Promise.all([
    supabase.from('flow_nodes').select('*').eq('flow_id', exec.flow_id),
    supabase.from('flow_edges').select('*').eq('flow_id', exec.flow_id),
  ])

  const nodes = nodesRes.data ?? []
  const edges = edgesRes.data ?? []
  const currentNodeId = exec.current_node_id as string
  const currentNode = nodes.find((n: Record<string, unknown>) => n.id === currentNodeId)

  if (!currentNode) {
    await supabase.from('flow_executions').update({ status: 'completed', finished_at: new Date().toISOString() }).eq('id', exec.id)
    return
  }

  const vars = (exec.variables ?? {}) as Record<string, string>
  let startNodeId = currentNodeId

  // Se estava em Q&A: salvar a resposta e avançar
  if (exec.status === 'waiting_response' && currentNode.type === 'question') {
    const data = (currentNode.data ?? {}) as NodeData
    const variable = (data.variable as string) || 'resposta'
    const newVars = { ...vars, [variable]: inputText }
    await supabase.from('flow_executions').update({ variables: newVars, status: 'running', updated_at: new Date().toISOString() }).eq('id', exec.id)

    const nextId = getNextNodeId(edges, currentNodeId)
    if (!nextId) {
      await supabase.from('flow_executions').update({ status: 'completed', finished_at: new Date().toISOString() }).eq('id', exec.id)
      return
    }
    startNodeId = nextId
    exec = { ...exec, variables: newVars }
  }

  // Se estava em agente IA: continuar
  if (exec.status === 'waiting_response' && currentNode.type === 'ai_agent') {
    await supabase.from('flow_executions').update({ status: 'running', updated_at: new Date().toISOString() }).eq('id', exec.id)
  }

  // Se estava em delay: avançar para próximo
  if (exec.status === 'delayed') {
    await supabase.from('flow_executions').update({ status: 'running', resume_at: null, updated_at: new Date().toISOString() }).eq('id', exec.id)
    startNodeId = exec.current_node_id as string
  }

  await runExecution(supabase, { ...exec, variables: vars }, nodes, edges, startNodeId, inputText, params)
}

export async function dispatchKanbanFlows(
  supabase: Supabase,
  userId: string,
  clienteId: number,
  secaoId: number,
): Promise<void> {
  const { data: lead } = await supabase
    .from('clientes')
    .select('telefone, instancia_id')
    .eq('id', clienteId)
    .maybeSingle()

  if (!lead?.telefone) return

  const { data: flows } = await supabase
    .from('flows')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('trigger_type', 'kanban_status_change')

  if (!flows || flows.length === 0) return

  const matched = flows.filter((f: Record<string, unknown>) => {
    const cfg = (f.trigger_config ?? {}) as Record<string, unknown>
    return String(cfg.kanban_secao_id) === String(secaoId)
  })

  if (matched.length === 0) return

  const [config, tenantConfig] = await Promise.all([
    readConfig(),
    readTenantConfig(userId),
  ])

  const base = (config.uazapiUrl || '').replace(/\/+$/, '').replace(/\/send\/.*$/, '')
  const openaiKey = tenantConfig?.openaiKey || ''

  let instanciaToken = ''
  const instanceId = matched[0].whatsapp_instance_id as string | null
  if (instanceId) {
    const { data: inst } = await supabase
      .from('instancias_whatsapp')
      .select('token')
      .eq('id', instanceId)
      .maybeSingle()
    instanciaToken = inst?.token || ''
  }
  if (!instanciaToken) instanciaToken = (lead.instancia_id as string) || ''

  const params = { userId, instanciaToken, uazapiBase: base, openaiKey }

  for (const flow of matched) {
    await startFlowExecution(supabase, flow, clienteId, lead.telefone as string, '', params).catch(() => {})
  }
}

export async function handleFlowExecution(
  supabase: Supabase,
  params: ExecParams & { clienteId: number | null; telefone: string; inputTexto: string },
): Promise<boolean> {
  const { userId, telefone, inputTexto, clienteId } = params

  // 1. Execução pausada aguardando resposta
  const { data: pausedExec } = await supabase
    .from('flow_executions')
    .select('*, flows!inner(user_id, status)')
    .eq('phone', telefone)
    .in('status', ['waiting_response'])
    .eq('flows.user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pausedExec) {
    await continueExecution(supabase, pausedExec, inputTexto, params)
    return true
  }

  // 2. Execução atrasada pronta para retomar
  const { data: delayedExec } = await supabase
    .from('flow_executions')
    .select('*, flows!inner(user_id, status)')
    .eq('phone', telefone)
    .eq('status', 'delayed')
    .eq('flows.user_id', userId)
    .lte('resume_at', new Date().toISOString())
    .limit(1)
    .maybeSingle()

  if (delayedExec) {
    await continueExecution(supabase, delayedExec, inputTexto, params)
    return true
  }

  // 3. Fluxo ativo com gatilho correspondente
  const { data: flows } = await supabase
    .from('flows')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('channel', 'whatsapp')

  if (!flows || flows.length === 0) return false

  const matchedFlow = flows.find((f: Record<string, unknown>) => {
    if (f.trigger_type === 'nova_mensagem') return true
    if (f.trigger_type === 'palavra_chave') {
      const keyword = ((f.trigger_config as Record<string, unknown>)?.keyword as string || '').toLowerCase().trim()
      return keyword && inputTexto.toLowerCase().includes(keyword)
    }
    return false
  })

  if (!matchedFlow) return false

  await startFlowExecution(supabase, matchedFlow, clienteId, telefone, inputTexto, params)
  return true
}
