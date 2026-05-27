'use client'

import { useState } from 'react'

interface Props {
  nome: string
  foto?: string | null
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'w-9 h-9 text-sm',
  md: 'w-11 h-11 text-base',
  lg: 'w-12 h-12 text-base',
}

const COLORS = [
  '#8E24AA', '#5E35B1', '#1E88E5', '#039BE5',
  '#00897B', '#43A047', '#6D4C41', '#546E7A',
  '#D81B60', '#FB8C00', '#00ACC1', '#3949AB',
]

function getColor(nome: string): string {
  let hash = 0
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

export default function Avatar({ nome, foto, size = 'md' }: Props) {
  const [imgError, setImgError] = useState(false)
  const sizeClass = sizeMap[size]
  const initials = nome.trim().slice(0, 2).toUpperCase()
  const bg = getColor(nome)
  const semNome = !nome.trim() || initials.length === 0

  if (foto && !imgError) {
    return (
      <img
        src={foto}
        alt={nome}
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover shrink-0`}
      />
    )
  }

  if (semNome) {
    return (
      <div className={`${sizeClass} rounded-full bg-gray-200 flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 24 24" className="w-3/5 h-3/5" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="8" r="4" fill="#9CA3AF" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="#9CA3AF" />
        </svg>
      </div>
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-semibold text-white shrink-0`}
      style={{ backgroundColor: bg }}
    >
      {initials}
    </div>
  )
}
