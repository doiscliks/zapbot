'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { NODE_CONFIG, getNodePreview } from './nodeConfig'

function FlowNode({ data, selected }: NodeProps) {
  const nodeType = (data.nodeType as string) || 'message'
  const config = NODE_CONFIG[nodeType as keyof typeof NODE_CONFIG] ?? NODE_CONFIG.message
  const Icon = config.icon
  const isStart = nodeType === 'start'
  const isEnd = nodeType === 'end'

  return (
    <div
      className={`w-56 bg-white rounded-xl shadow-md overflow-visible border-2 transition-colors ${
        selected ? 'border-purple-500' : 'border-gray-100'
      }`}
    >
      {!isStart && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
        />
      )}

      <div className={`${config.headerClass} flex items-center gap-2 px-3 py-2`}>
        <Icon size={13} className="text-white shrink-0" />
        <span className="text-white text-xs font-semibold truncate">{config.label}</span>
      </div>

      <div className="px-3 py-2.5">
        <p className="text-xs text-gray-500 line-clamp-2 min-h-[2rem]">
          {getNodePreview(data as Record<string, unknown>)}
        </p>
      </div>

      {!isEnd && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
        />
      )}
    </div>
  )
}

export default memo(FlowNode)
