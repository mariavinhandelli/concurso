'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { parseEdital } from '@/lib/parse-edital';
import { importEditalAsTarget } from '@/services/editalImport.service';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';

export function ImportarEditalModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (targetId: string) => void;
}) {
  const toast = useToast();
  const [orgao, setOrgao] = useState('');
  const [cargo, setCargo] = useState('');
  const [raw, setRaw] = useState('');
  const [saving, setSaving] = useState(false);

  const groups = useMemo(() => parseEdital(raw), [raw]);
  const totalTopics = groups.reduce((acc, g) => acc + g.topics.length, 0);

  async function handleConfirm() {
    if (groups.length === 0) return;
    setSaving(true);
    try {
      const targetId = await importEditalAsTarget({ orgao, cargo, groups });
      onImported(targetId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao importar edital.');
      setSaving(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <div>
            <h2 style={s.h2}>Importar edital colado</h2>
            <p style={s.sub}>Cole o conteúdo programático. Disciplinas em CAIXA ALTA viram matérias; as linhas abaixo, tópicos.</p>
          </div>
          <button style={s.close} onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <div style={s.fields}>
          <input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo (ex: Analista)" style={s.input} />
          <input value={orgao} onChange={(e) => setOrgao(e.target.value)} placeholder="Órgão (opcional)" style={s.input} />
        </div>

        <div style={s.split}>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={'LÍNGUA PORTUGUESA\n1. Interpretação de textos\n2. Ortografia\n\nDIREITO CONSTITUCIONAL\n1. Princípios fundamentais\n2. Direitos e garantias'}
            style={s.textarea}
            autoFocus
          />
          <div style={s.preview}>
            <div style={s.previewHeader}>
              {groups.length === 0 ? 'Pré-visualização' : `${groups.length} matéria(s) · ${totalTopics} tópicos`}
            </div>
            {groups.length === 0 ? (
              <p style={s.previewEmpty}>As matérias e tópicos detectados aparecem aqui.</p>
            ) : (
              <div style={s.groupList}>
                {groups.map((g, i) => (
                  <div key={i} style={s.groupItem}>
                    <span style={s.groupName}>{g.subject}</span>
                    <span style={s.groupCount}>{g.topics.length}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={s.actions}>
          <button onClick={onClose} style={s.cancelBtn}>Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={groups.length === 0 || saving}
            style={{ ...s.confirmBtn, ...(groups.length === 0 || saving ? s.confirmOff : {}) }}
          >
            {saving ? 'Criando…' : groups.length === 0 ? 'Criar concurso' : `Criar concurso com ${groups.length} matéria(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'var(--backdrop)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 },
  modal: { background: theme.card, borderRadius: theme.radius, boxShadow: theme.shadowModal, padding: 24, width: '100%', maxWidth: 680, maxHeight: '92vh', overflowY: 'auto', fontFamily: theme.font },
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  h2: { fontSize: 18, fontWeight: 700, color: theme.ink, margin: 0 },
  sub: { fontSize: 13, color: theme.inkSoft, margin: '5px 0 0', lineHeight: 1.5 },
  close: { border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', padding: 4, lineHeight: 1, flexShrink: 0 },

  fields: { display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  input: { flex: 1, minWidth: 140, padding: '10px 14px', borderRadius: theme.radiusSm, border: `1px solid ${theme.lineStrong}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },

  split: { display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' },
  textarea: { flex: 1, minWidth: 240, minHeight: 240, padding: 14, borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.6 },
  preview: { flex: 1, minWidth: 200, minHeight: 240, maxHeight: 320, overflowY: 'auto', padding: 14, borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.muted },
  previewHeader: { fontSize: 12, fontWeight: 700, color: theme.inkSoft, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  previewEmpty: { fontSize: 13, color: theme.inkFaint, margin: 0 },
  groupList: { display: 'flex', flexDirection: 'column', gap: 6 },
  groupItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: theme.radiusXs, background: theme.card, border: `0.5px solid ${theme.line}` },
  groupName: { fontSize: 13.5, color: theme.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  groupCount: { fontSize: 12, color: theme.teal, fontWeight: 700, flexShrink: 0 },

  actions: { display: 'flex', gap: 12, justifyContent: 'flex-end' },
  cancelBtn: { padding: '11px 22px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  confirmBtn: { padding: '11px 22px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  confirmOff: { background: theme.muted, color: theme.inkFaint, cursor: 'not-allowed' },
};
