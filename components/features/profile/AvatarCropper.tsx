// components/features/profile/AvatarCropper.tsx
// Modal de recorte de avatar: máscara circular, arraste + zoom (react-easy-crop).
// Exporta o recorte como Blob JPG quadrado, já comprimido, pronto pro upload.
'use client';

import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { theme } from '@/lib/theme';

interface Props {
  // URL local (object URL) da imagem escolhida pelo usuário.
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}

// Gera o recorte quadrado a partir da área selecionada, redimensiona e comprime.
async function getCroppedBlob(imageSrc: string, area: Area): Promise<Blob> {
  const OUT = 512; // avatar final 512×512 — suficiente e leve
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = OUT;
  canvas.height = OUT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível inicializar o canvas. Verifique as configurações do navegador.');

  // Desenha apenas a área recortada, esticada para o quadro de saída.
  ctx.drawImage(
    img,
    area.x, area.y, area.width, area.height,
    0, 0, OUT, OUT,
  );

  return new Promise<Blob>((res, rej) => {
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error('Falha ao gerar o recorte.'))),
      'image/jpeg',
      0.85,
    );
  });
}

export function AvatarCropper({ imageSrc, onCancel, onConfirm }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setAreaPixels(pixels);
  }, []);

  async function handleConfirm() {
    if (!areaPixels) return;
    setProcessing(true);
    setCropError(null);
    try {
      const blob = await getCroppedBlob(imageSrc, areaPixels);
      onConfirm(blob);
    } catch (err) {
      setCropError(err instanceof Error ? err.message : 'Erro ao recortar a imagem. Tente novamente.');
      setProcessing(false);
    }
  }

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={styles.title}>Ajustar foto</h3>
        <p style={styles.hint}>Arraste para posicionar e use o controle para aproximar.</p>

        <div style={styles.cropArea}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div style={styles.zoomRow}>
          <span style={styles.zoomIcon}>−</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={styles.slider}
            aria-label="Zoom"
          />
          <span style={styles.zoomIcon}>+</span>
        </div>

        {cropError && (
          <p role="alert" style={styles.errorMsg}>{cropError}</p>
        )}

        <div style={styles.actions}>
          <button onClick={onCancel} disabled={processing} style={styles.cancelBtn}>Cancelar</button>
          <button onClick={handleConfirm} disabled={processing || !areaPixels}
            style={{ ...styles.confirmBtn, opacity: processing || !areaPixels ? 0.6 : 1 }}>
            {processing ? 'Processando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'var(--backdrop)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 },
  modal: { background: theme.card, borderRadius: theme.radius, padding: 24, width: 'min(420px, 95vw)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: theme.font, boxSizing: 'border-box' },
  title: { fontSize: 18, fontWeight: 700, color: theme.ink, margin: '0 0 4px' },
  hint: { fontSize: 13, color: theme.inkSoft, margin: '0 0 16px', lineHeight: 1.45 },
  cropArea: { position: 'relative', width: '100%', height: 300, background: theme.bg, borderRadius: theme.radiusSm, overflow: 'hidden' },
  zoomRow: { display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0 4px' },
  zoomIcon: { fontSize: 18, fontWeight: 700, color: theme.inkSoft, width: 16, textAlign: 'center', flexShrink: 0 },
  slider: { flex: 1, accentColor: theme.teal, cursor: 'pointer' },
  actions: { display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 18 },
  cancelBtn: { padding: '11px 20px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  confirmBtn: { padding: '11px 24px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  errorMsg: { fontSize: 13, color: theme.danger, background: theme.dangerTint, borderRadius: 8, padding: '8px 12px', margin: '12px 0 0' },
};