import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Focali — Clareza para evoluir.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          background: '#0F172A',
          padding: '80px 96px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Blob decorativo canto direito */}
        <div
          style={{
            position: 'absolute',
            right: -120,
            bottom: -120,
            width: 600,
            height: 600,
            borderRadius: '50%',
            background: 'rgba(143,231,194,0.18)',
            filter: 'blur(80px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 80,
            bottom: -80,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'rgba(154,165,255,0.15)',
            filter: 'blur(80px)',
          }}
        />

        {/* Logo row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            marginBottom: 48,
          }}
        >
          {/* Símbolo F simplificado */}
          <svg width="72" height="72" viewBox="0 0 512 512" fill="none">
            <path
              d="M118 151C118 120.624 142.624 96 173 96H331C359.719 96 383 119.281 383 148C383 176.719 359.719 200 331 200H222C193.281 200 170 223.281 170 252V252H118V151Z"
              fill="#22C55E"
            />
            <path
              d="M170 252C170 223.281 193.281 200 222 200H292C320.719 200 344 223.281 344 252C344 280.719 320.719 304 292 304H170V252Z"
              fill="#A7F5D0"
            />
            <path
              d="M175 304H227V361C227 391.376 202.376 416 172 416C142.177 416 118 391.823 118 362C118 330 143 304 175 304Z"
              fill="#6366F1"
            />
          </svg>

          {/* Texto "focali" */}
          <span
            style={{
              fontSize: 80,
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-3px',
              lineHeight: 1,
            }}
          >
            focali
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: '#FFFFFF',
            lineHeight: 1.15,
            letterSpacing: '-1px',
            marginBottom: 20,
            maxWidth: 780,
          }}
        >
          Seu foco,{' '}
          <span style={{ color: '#22C55E' }}>com direção.</span>
        </div>

        {/* Slogan */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 400,
            color: '#94A3B8',
            letterSpacing: '-0.5px',
          }}
        >
          Plataforma de estudos de alta performance para concursos.
        </div>

        {/* URL */}
        <div
          style={{
            position: 'absolute',
            bottom: 56,
            right: 96,
            fontSize: 22,
            color: '#475569',
            fontWeight: 500,
          }}
        >
          focali.com.br
        </div>
      </div>
    ),
    { ...size },
  );
}
