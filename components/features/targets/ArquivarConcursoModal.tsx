// components/features/targets/ArquivarConcursoModal.tsx
// M11 — Modal do gesto de arquivar concurso: mostra o preview do que será
// ocultado (ciclo ativo + matérias exclusivas) e o que fica (compartilhadas),
// deixa o usuário escolher, e executa. Nada é apagado — tudo restaurável.
'use client';

import { useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check as CheckIcon, Info } from 'lucide-react';
import { getConcursoArchivePreview, archiveConcurso, type ConcursoArchivePreview } from '@/services/concursoArchive.service';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';
import { Overlay } from '@/components/ui/Overlay';
import { Button } from '@/components/ui/Button';

export function ArquivarConcursoModal({
  target, onClose, onArchived,
}: {
  target: { id: string; label: string };
  onClose: () => void;
  onArchived: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  // null = ainda não mexeu → usa o default derivado do preview.
  const [selSubjects, setSelSubjects] = useState<Set<string> | null>(null);
  const [cycleOverride, setCycleOverride] = useState<boolean | null>(null);

  const { data: preview } = useQuery<ConcursoArchivePreview>({
    queryKey: ['concurso-archive-preview', target.id],
    queryFn: () => getConcursoArchivePreview(target.id),
    staleTime: 0,
  });

  // Seleção efetiva: default (tudo exclusivo marcado, ciclo marcado se houver)
  // até o usuário tocar em algo — sem efeito/setState-in-effect.
  const effSubjects = selSubjects ?? new Set(preview?.exclusiveSubjects.map((s) => s.id) ?? []);
  const effCycle = cycleOverride ?? (preview?.hasActiveCycle ?? false);

  function toggleSubject(id: string) {
    const next = new Set(effSubjects);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelSubjects(next);
  }

  async function confirmar() {
    if (saving) return;
    setSaving(true);
    try {
      await archiveConcurso(target.id, { subjectIds: [...effSubjects], includeCycle: effCycle });
      toast.success('Concurso arquivado — você pode restaurá-lo quando quiser.');
      onArchived();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao arquivar o concurso.');
      setSaving(false);
    }
  }

  return (
    <Overlay onClose={onClose} maxWidth={440} labelledBy="arquivar-concurso-title">
      <h3 id="arquivar-concurso-title" style={s.title}>Arquivar {target.label}?</h3>
        <p style={s.sub}>Ele sai do painel, do countdown e da cobertura — mas <b>nada é apagado</b>. Dá pra restaurar depois.</p>

        {preview === undefined ? (
          <p style={s.muted}>Verificando o que pode ser arquivado junto…</p>
        ) : (
          <div style={s.body}>
            {preview.hasActiveCycle && (
              <button onClick={() => setCycleOverride(!effCycle)} style={s.row} role="checkbox" aria-checked={effCycle}>
                <Check on={effCycle} />
                <span style={s.rowLabel}>Arquivar também o ciclo de estudos ativo</span>
              </button>
            )}

            {preview.exclusiveSubjects.length > 0 && (
              <div style={s.group}>
                <p style={s.groupTitle}>Matérias usadas só neste concurso</p>
                {preview.exclusiveSubjects.map((sub) => (
                  <button key={sub.id} onClick={() => toggleSubject(sub.id)} style={s.row} role="checkbox" aria-checked={effSubjects.has(sub.id)}>
                    <Check on={effSubjects.has(sub.id)} />
                    <span style={s.rowLabel}>{sub.name}</span>
                  </button>
                ))}
              </div>
            )}

            {preview.sharedCount > 0 && (
              <p style={s.info}>
                <Info size={14} color={theme.teal} strokeWidth={2} style={{ flexShrink: 0 }} />
                {preview.sharedCount} {preview.sharedCount === 1 ? 'matéria compartilhada' : 'matérias compartilhadas'} com outros concursos {preview.sharedCount === 1 ? 'continua ativa' : 'continuam ativas'}.
              </p>
            )}

            {!preview.hasActiveCycle && preview.exclusiveSubjects.length === 0 && (
              <p style={s.muted}>Só o concurso será arquivado — nada exclusivo dele a ocultar.</p>
            )}
          </div>
        )}

        <div style={s.actions}>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={confirmar} disabled={preview === undefined} loading={saving}>
            {saving ? 'Arquivando…' : 'Arquivar'}
          </Button>
        </div>
    </Overlay>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span style={{ ...checkStyle.box, ...(on ? { background: theme.teal, borderColor: theme.teal } : {}) }}>
      {on && <CheckIcon size={12} color={theme.onTeal} strokeWidth={3.2} />}
    </span>
  );
}

const checkStyle = {
  box: { width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${theme.line}`, background: theme.card, display: 'grid', placeItems: 'center', flexShrink: 0 } as CSSProperties,
};

const s: Record<string, CSSProperties> = {
  title: { fontSize: 18, fontWeight: 700, color: theme.ink, margin: '0 0 6px' },
  sub: { fontSize: 14, color: theme.inkSoft, margin: '0 0 16px', lineHeight: 1.5 },
  body: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 },
  group: { display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 },
  groupTitle: { fontSize: 12, fontWeight: 700, color: theme.inkFaint, letterSpacing: 0.4, textTransform: 'uppercase', margin: '4px 0 4px' },
  row: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 4px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  rowLabel: { fontSize: 14, color: theme.ink, fontWeight: 500 },
  info: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: theme.inkSoft, background: theme.tealBg, borderRadius: theme.radiusSm, padding: '10px 12px', margin: '10px 0 0', lineHeight: 1.45 },
  muted: { fontSize: 13, color: theme.inkFaint, margin: '4px 0' },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 },
};
