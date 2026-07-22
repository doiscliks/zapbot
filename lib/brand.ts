// Branding configurável por variáveis de ambiente.
// Defina NEXT_PUBLIC_BRAND_* no .env do Vercel para cada projeto.
// Defaults = 2Cliks (funciona sem nenhum env set).

export const brand = {
  name:          process.env.NEXT_PUBLIC_BRAND_NAME          ?? '2Cliks Contabilidade',
  shortName:     process.env.NEXT_PUBLIC_BRAND_SHORT_NAME    ?? '2Cliks',
  tagline:       process.env.NEXT_PUBLIC_BRAND_TAGLINE       ?? 'Contabilidade Digital Inteligente',
  logoChar:      process.env.NEXT_PUBLIC_BRAND_LOGO_CHAR     ?? '2',
  logoSubtitle:  process.env.NEXT_PUBLIC_BRAND_LOGO_SUBTITLE ?? 'Contabilidade',
  primary:       process.env.NEXT_PUBLIC_BRAND_COLOR_PRIMARY      ?? '#12C6D6',
  primaryDark:   process.env.NEXT_PUBLIC_BRAND_COLOR_PRIMARY_DARK ?? '#0FBDCC',
  secondary:     process.env.NEXT_PUBLIC_BRAND_COLOR_SECONDARY    ?? '#FF7A66',
}

/** Retorna hex com canal alpha (ex: hexAlpha('#12C6D6', 0.35) → '#12C6D659') */
export function hexAlpha(hex: string, alpha: number): string {
  const h = hex.startsWith('#') ? hex.slice(1, 7) : hex.slice(0, 6)
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0')
  return `#${h}${a}`
}

/** CSS custom properties calculadas a partir das cores base */
export function brandCssVars(): React.CSSProperties {
  const { primary, primaryDark, secondary } = brand
  return {
    '--brand-primary':       primary,
    '--brand-primary-dark':  primaryDark,
    '--brand-secondary':     secondary,
    '--brand-gradient':      `linear-gradient(135deg, ${primary} 0%, ${primaryDark} 100%)`,
    '--brand-gradient-light': `linear-gradient(135deg, ${hexAlpha(primary, 0.15)} 0%, ${hexAlpha(primary, 0.08)} 100%)`,
    '--brand-shadow':        `0 4px 14px ${hexAlpha(primary, 0.35)}`,
    '--brand-shadow-lg':     `0 8px 24px ${hexAlpha(primary, 0.35)}`,
    '--brand-shadow-sm':     `0 2px 8px ${hexAlpha(primary, 0.30)}`,
    '--brand-shadow-xs':     `0 2px 6px ${hexAlpha(primary, 0.25)}`,
    '--brand-shadow-md':     `0 3px 10px ${hexAlpha(primary, 0.35)}`,
    '--brand-glow':          `0 25px 60px ${hexAlpha(primary, 0.10)}, 0 8px 24px rgba(0,0,0,0.06)`,
    '--brand-glow-lg':       `0 32px 80px ${hexAlpha(primary, 0.12)}, 0 8px 32px rgba(0,0,0,0.06)`,
    '--brand-border-card':   `1px solid ${hexAlpha(primary, 0.12)}`,
    '--brand-border-10':     `1px solid ${hexAlpha(primary, 0.10)}`,
    '--brand-border-15':     `1px solid ${hexAlpha(primary, 0.15)}`,
    '--brand-border-20':     `1px solid ${hexAlpha(primary, 0.20)}`,
    '--brand-border-25':     `1px solid ${hexAlpha(primary, 0.25)}`,
    '--brand-border-40':     `1.5px solid ${hexAlpha(primary, 0.40)}`,
    '--brand-alpha-04':      hexAlpha(primary, 0.04),
    '--brand-alpha-05':      hexAlpha(primary, 0.05),
    '--brand-alpha-08':      hexAlpha(primary, 0.08),
    '--brand-alpha-12':      hexAlpha(primary, 0.12),
    '--brand-alpha-15':      hexAlpha(primary, 0.15),
    '--brand-alpha-20':      hexAlpha(primary, 0.20),
    '--brand-alpha-40':      hexAlpha(primary, 0.40),
    '--brand-ring-08':       hexAlpha(primary, 0.08),
    '--brand-ring-07':       hexAlpha(primary, 0.07),
    '--brand-tint-bg':       hexAlpha(primary, 0.06),
    '--brand-tint-subtle':   hexAlpha(primary, 0.08),
  } as React.CSSProperties
}
