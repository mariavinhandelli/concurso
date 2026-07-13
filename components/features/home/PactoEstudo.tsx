// components/features/home/PactoEstudo.tsx
// Intenção de implementação (Atomic Habits): "Depois de [âncora], eu estudo."
// A linha aparece no Plano de Hoje ENQUANTO o dia não começou — é o cue que
// liga o estudo a um hábito existente — e some assim que a pessoa estuda
// (cue cumprido, sem ruído). Sem âncora definida, oferece criar uma em 1 toque.
// Ético por construção: opcional, editável, removível, nunca cobra ou culpa.
'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { getStudyAnchor, setStudyAnchor } from '@/services/goals.service';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';
import { Input } from '@/components/ui/Input';

// Âncoras com a contração embutida ("do", "da") para a frase compor natural:
// "depois do almoço", "depois da janta escrita pelo usuário", etc.
export const ANCORAS_SUGERIDAS = [
  'do café da manhã',
  'do almoço',
  'do trabalho',
  'do jantar',
];

export function PactoEstudo({ diaComecou }: { diaComecou: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: anchor } = useQuery<string | null>({
    queryKey: ['study-anchor'],
    queryFn: getStudyAnchor,
    staleTime: 5 * 60_000,
  });

  // Cue cumprido (já estudou) ou dados ainda carregando → nada a mostrar.
  if (diaComecou || anchor === undefined) return null;

  async function salvar(valor: string | null) {
    setSaving(true);
    try {
      await setStudyAnchor(valor);
      queryClient.setQueryData(['study-anchor'], valor);
      setEditing(false);
      setCustom('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar o pacto.');
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div style={s.editor}>
        <span style={s.editorLabel}>Eu estudo depois…</span>
        <div style={s.chips}>
          {ANCORAS_SUGERIDAS.map((a) => (
            <button key={a} style={s.chip} disabled={saving} onClick={() => salvar(a)}>{a}</button>
          ))}
        </div>
        <div style={s.customRow}>
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && custom.trim()) salvar(custom); }}
            placeholder="ou escreva a sua: do treino, da faculdade…"
            style={{ flex: 1, minWidth: 0, padding: '7px 10px', fontSize: 13 }}
            maxLength={60}
          />
          <button style={s.saveBtn} disabled={saving || !custom.trim()} onClick={() => salvar(custom)}>Salvar</button>
        </div>
        <div style={s.editorFoot}>
          <button style={s.ghostBtn} onClick={() => { setEditing(false); setCustom(''); }}>cancelar</button>
          {anchor && (
            <button style={s.ghostBtn} disabled={saving} onClick={() => salvar(null)}>remover pacto</button>
          )}
        </div>
      </div>
    );
  }

  if (!anchor) {
    return (
      <button style={s.criar} onClick={() => setEditing(true)}>
        <span style={s.emoji}>🤝</span>
        <span style={s.criarText}>
          Crie um <b style={s.criarHi}>pacto de estudo</b> — ligue o estudo a algo que você já faz todo dia
        </span>
      </button>
    );
  }

  return (
    <button style={s.linha} onClick={() => setEditing(true)} title="Editar pacto">
      <span style={s.emoji}>🤝</span>
      <span style={s.linhaText}>
        Seu pacto: depois <b style={s.linhaHi}>{anchor}</b>, o primeiro passo do plano.
      </span>
      <Pencil size={13} color={theme.inkFaint} strokeWidth={2} style={{ flexShrink: 0 }} />
    </button>
  );
}

const s: Record<string, React.CSSProperties> = {
  linha: {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', marginBottom: 12,
    padding: '8px 12px', borderRadius: theme.radiusSm, border: 'none',
    background: theme.tealBg, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', minWidth: 0,
  },
  linhaText: { fontSize: 13, color: theme.inkSoft, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  linhaHi: { color: theme.tealDeep, fontWeight: 700 },
  emoji: { fontSize: 14, flexShrink: 0 },

  criar: {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', marginBottom: 12,
    padding: '8px 12px', borderRadius: theme.radiusSm, border: `0.5px dashed ${theme.line}`,
    background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', minWidth: 0,
  },
  criarText: { fontSize: 13, color: theme.inkSoft, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  criarHi: { color: theme.ink, fontWeight: 700 },

  editor: {
    marginBottom: 12, padding: '10px 12px', borderRadius: theme.radiusSm,
    border: `0.5px solid ${theme.line}`, background: theme.bg,
  },
  editorLabel: { display: 'block', fontSize: 12, fontWeight: 700, color: theme.ink, marginBottom: 8 },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  chip: {
    padding: '6px 12px', borderRadius: theme.radiusPill, borderWidth: 0.5, borderStyle: 'solid',
    borderColor: theme.line, background: theme.card, color: theme.inkSoft,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  customRow: { display: 'flex', gap: 6 },
  saveBtn: {
    padding: '7px 14px', borderRadius: theme.radiusSm, border: 'none',
    background: theme.teal, color: theme.onTeal, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
  },
  editorFoot: { display: 'flex', justifyContent: 'space-between', marginTop: 8 },
  ghostBtn: {
    border: 'none', background: 'transparent', color: theme.inkFaint,
    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
  },
};
