import FlowEditor from '@/components/flow/FlowEditor'

export default async function FlowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FlowEditor flowId={id} />
    </div>
  )
}
