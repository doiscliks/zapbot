'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { NODE_CONFIG, getNodePreview } from './nodeConfig'

function ConditionNode({ data, selected }: NodeProps) {
  const config = NODE_CONFIG.condition
  const Icon = config.icon

  return (
    <div className="relative w-56">
      <div
        className={`bg-white rounded-xl shadow-md overflow-visible border-2 transition-colors ${
          selected ? 'border-purple-500' : 'border-gray-100'
        }`}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
        />

        <div className={`${config.headerClass} flex items-center gap-2 px-3 py-2`}>
          <Icon size={13} className="text-white shrink-0" />
          <span className="text-white text-xs font-semibold">Condição</span>
        </div>

        <div className="px-3 py-2.5">
          <p className="text-xs text-gray-500 line-clamp-2 min-h-[2rem]">
            {getNodePreview(data as Record<string, unknown>)}
          </p>
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          id="true"
          style={{ left: '28%' }}
          className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="false"
          style={{ left: '72%' }}
          className="!w-3 !h-3 !bg-red-400 !border-2 !border-white"
        />
      </div>

      <div className="flex justify-between px-6 mt-1 text-xs font-medium pointer-events-none select-none">
        <span className="text-emerald-600">Sim</span>
        <span className="text-red-400">Não</span>
      </div>
    </div>
  )
}

export default memo(ConditionNode)
