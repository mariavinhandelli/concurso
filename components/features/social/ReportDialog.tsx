// components/features/social/ReportDialog.tsx
// P1-5 — não existia canal nenhum de denúncia: quem recebesse um nome ofensivo
// ou assédio não tinha o que fazer além de recusar o pedido de novo. Reusa o
// primitivo Overlay (focus trap, Esc, lock de scroll) em vez de um modal novo.
'use client';

import { useState, type CSSProperties } from 'react';
import { MOTIVOS_DENUNCIA } from '@/services/social.service';
import { Overlay } from '@/components/ui/Overlay';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { theme } from '@/lib/theme';

export function ReportDialog({
  nome, onCancel, onSubmit, busy,
}: {
  nome: string;
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (reason: string, details: string) => void;
}) {
  const [reason, setReason] = useState<string>(MOTIVOS_DENUNCIA[0].value);
  const [details, setDetails] = useState('');

  return (
    <Overlay onClose={onCancel} labelledBy="report-title" maxWidth={440}>
      <h2 id="report-title" style={s.title}>Denunciar {nome}</h2>
      {/* Sem concordância de gênero sobre o nome: quem está do outro lado é uma
          pessoa real e o app não sabe (nem precisa saber) o gênero dela. */}
      <p style={s.body}>
        A denúncia vai para a nossa moderação, e {nome} não recebe nenhum aviso disso.
        Se você também não quer mais receber pedidos dessa pessoa, use <b style={s.strong}>Bloquear</b>.
      </p>

      <Select label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: '100%' }}>
        {MOTIVOS_DENUNCIA.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
      </Select>

      <div style={{ marginTop: 14 }}>
        <Textarea
          label="Detalhes (opcional)"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="O que aconteceu?"
          style={{ width: '100%' }}
        />
      </div>
      <span style={s.contador}>{details.length}/1000</span>

      <div style={s.acoes}>
        <Button variant="outline" onClick={onCancel} disabled={busy}>Cancelar</Button>
        <Button onClick={() => onSubmit(reason, details)} disabled={busy}>
          {busy ? 'Enviando…' : 'Enviar denúncia'}
        </Button>
      </div>
    </Overlay>
  );
}

const s: Record<string, CSSProperties> = {
  title: { fontSize: 18, fontWeight: 800, color: theme.ink, margin: '0 0 8px', letterSpacing: -0.3 },
  body: { fontSize: 14, color: theme.inkSoft, lineHeight: 1.6, margin: '0 0 18px' },
  strong: { color: theme.ink, fontWeight: 700 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: theme.inkFaint, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  contador: { display: 'block', fontSize: 11, color: theme.inkFaint, textAlign: 'right', marginTop: 4 },
  acoes: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 },
};
