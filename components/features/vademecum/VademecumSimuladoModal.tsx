// components/features/vademecum/VademecumSimuladoModal.tsx
// Modal de configuração do simulado combinado — mesmo padrão do JurisSimulado
// (Overlay compacto, some da tela até ser aberto por um botão pequeno) em vez
// de uma caixa fixa ocupando a biblioteca. Só escolhe as leis; a execução do
// simulado em si continua em /vademecum/simulado (engine já existente).
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CircleHelp } from 'lucide-react';
import { Overlay } from '@/components/ui/Overlay';
import { LEIS_CATALOG, type LeiMeta } from '@/services/leis.service';
import { getQuestoesLei, LEIS_COM_QUESTOES } from '@/services/leiQuestoes.service';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';

function useQuestoesCount(slug: string): number {
  const { data } = useQuery({
    queryKey: ['vademecum-questoes-count', slug],
    queryFn: async () => (await getQuestoesLei(slug)).length,
    staleTime: 5 * 60_000,
  });
  return data ?? 0;
}

function LeiCheckboxRow({ lei, checked, onToggle }: { lei: LeiMeta; checked: boolean; onToggle: () => void }) {
  const total = useQuestoesCount(lei.slug);
  return (
    <label style={{ ...s.checkRow, ...(checked ? s.checkRowOn : {}) }}>
      <input type="checkbox" checked={checked} onChange={onToggle} style={s.checkInput} />
      <span style={s.checkNome}>{lei.nomeCurto}</span>
      <span style={s.checkCount}>{total} questões</span>
    </label>
  );
}

export function VademecumSimuladoModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const leis = useMemo(
    () => LEIS_COM_QUESTOES.map((slug) => LEIS_CATALOG.find((l) => l.slug === slug)).filter((l): l is LeiMeta => !!l),
    [],
  );
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  function toggle(slug: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  }

  function iniciar() {
    if (selecionadas.size === 0) return;
    const slugs = [...selecionadas].sort().join(',');
    router.push(`/vademecum/simulado?leis=${encodeURIComponent(slugs)}`);
  }

  return (
    <Overlay onClose={onClose} labelledBy="vademecum-simulado-title">
      <h2 id="vademecum-simulado-title" style={{ ...s.titulo, display: 'flex', alignItems: 'center', gap: 6 }}>
        <CircleHelp size={16} strokeWidth={1.7} />Simulado C/E
      </h2>
      <p style={s.sub}>Escolha uma ou mais leis para montar o simulado.</p>

      <div style={s.linksRow}>
        <button onClick={() => setSelecionadas(new Set(leis.map((l) => l.slug)))} style={s.linkBtn}>marcar todas</button>
        <button onClick={() => setSelecionadas(new Set())} style={s.linkBtn}>limpar</button>
      </div>

      <div style={s.checkGrid}>
        {leis.map((lei) => (
          <LeiCheckboxRow key={lei.slug} lei={lei} checked={selecionadas.has(lei.slug)} onToggle={() => toggle(lei.slug)} />
        ))}
      </div>

      <Button fullWidth onClick={iniciar} disabled={selecionadas.size === 0}>
        {selecionadas.size === 0
          ? 'Selecione ao menos uma lei'
          : `Iniciar simulado — ${selecionadas.size} lei${selecionadas.size === 1 ? '' : 's'} selecionada${selecionadas.size === 1 ? '' : 's'}`}
      </Button>
    </Overlay>
  );
}

const s: Record<string, React.CSSProperties> = {
  titulo: { fontSize: 20, fontWeight: 800, color: theme.ink, margin: '0 0 6px' },
  sub: { fontSize: 14, color: theme.inkSoft, margin: '0 0 16px' },
  linksRow: { display: 'flex', gap: 12, marginBottom: 12 },
  linkBtn: { fontSize: 12, color: theme.teal, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', padding: 0 },
  checkGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginBottom: 20 },
  checkRow: { display: 'flex', alignItems: 'center', gap: 8, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: theme.radiusSm, padding: '9px 12px', cursor: 'pointer', background: 'transparent' },
  checkRowOn: { borderColor: theme.teal, background: theme.tealBg },
  checkInput: { flexShrink: 0, cursor: 'pointer' },
  checkNome: { fontSize: 13, fontWeight: 600, color: theme.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  checkCount: { fontSize: 12, color: theme.inkFaint, flexShrink: 0 },
  iniciarBtn: { width: '100%', padding: '12px 0', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  iniciarBtnOff: { background: theme.line, color: theme.inkFaint, cursor: 'not-allowed' },
};
