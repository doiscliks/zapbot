'use client'

import { BLOCK_SECTIONS, NODE_CONFIG, NodeType } from './nodeConfig'

interface Props {
  onDragStart: (e: React.DragEvent, nodeType: NodeType) => void
}

export default function BlockPanel({ onDragStart }: Props) {
  return (
    <div className="w-52 bg-white border-r border-gray-100 flex flex-col overflow-y-auto shrink-0">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Blocos</p>
        <p className="text-xs text-gray-400 mt-0.5">Arraste para o canvas</p>
      </div>

      <div className="p-2 space-y-3 flex-1">
        {BLOCK_SECTIONS.map(section => (
          <div key={section.label}>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">{section.label}</p>
            <div className="space-y-1">
              {section.types.map((type) => {
                const cfg = NODE_CONFIG[type]
                const Icon = cfg.icon
                return (
                  <div
                    key={type}
                    draggable
                    onDragStart={(e) => onDragStart(e, type)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-gray-100 bg-gray-50 hover:bg-white hover:border-gray-200 hover:shadow-sm cursor-grab active:cursor-grabbing transition-all select-none"
                  >
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                      style={{ backgroundColor: cfg.color + '22' }}
                    >
                      <Icon size={11} style={{ color: cfg.color }} />
                    </div>
                    <span className="text-xs font-medium text-gray-700 leading-tight">{cfg.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
