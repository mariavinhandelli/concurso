// app/(app)/vademecum/revisar/page.tsx
// Fila de revisão espaçada de artigos: o texto aparece com os GRIFOS OCULTOS
// (lacunas) — recall ativo sem custo de criação de cartão. Clique revela cada
// lacuna; avalie com Errei/Difícil/Ok/Dominei (intervalos 1/3/15/45).
'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { getLei, LEIS_CATALOG, type Lei, type LeiArtigo } from '@/services/leis.service';
import { listRevisoesDue, submitRevisaoArtigo, type LeiInteracao } from '@/services/leiInteracoes.service';
import { RATING_LABEL, type JurisRating } from '@/lib/juris-review';
import { GRIFO_CORES, SUBLINHADO_COR, segmentarBloco } from '@/lib/lei-grifos';
import { refreshHomeAfterSession } from '@/lib/home-refresh';
import { useUI } from '@/components/layout/UIContext';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';

interface ItemFila {
  interacao: LeiInteracao;
  artigo: LeiArtigo;
  lei: Lei;
}

const RATINGS: { value: JurisRating; cor: string }[] = [
  { value: 'errei',   cor: '#E24B4A' },
  { value: 'dificil', cor: '#EF9F27' },
  { value: 'ok',      cor: '#1D9E75' },
  { value: 'dominei', cor: '#378ADD' },
];

export default function RevisarArtigosPage() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isMobile } = useUI();

  const [fila, setFila] = useState<ItemFila[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [reveladas, setReveladas] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [feitas, setFeitas] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const due = await listRevisoesDue();
        const slugs = new Set(due.map((d) => d.artigo_key.split(':')[0]));
        const leis = new Map<string, Lei>();
        for (const slug of slugs) {
          if (LEIS_CATALOG.some((l) => l.slug === slug)) leis.set(slug, await getLei(slug));
        }
        if (cancelled) return;
        const itens: ItemFila[] = [];
        for (const interacao of due) {
          const slug = interacao.artigo_key.split(':')[0];
          const lei = leis.get(slug);
          const artigo = lei?.artigos.find((a) => a.key === interacao.artigo_key);
          if (lei && artigo) itens.push({ interacao, artigo, lei });
        }
        setFila(itens);
      } catch {
        if (!cancelled) setFila([]);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const atual = fila?.[idx] ?? null;
  const grifos = useMemo(() => atual?.interacao.grifos ?? [], [atual]);
  const temLacunas = grifos.length > 0;

  async function avaliar(rating: JurisRating) {
    if (!atual || saving) return;
    setSaving(true);
    try {
      const row = await submitRevisaoArtigo(atual.artigo.key, rating);
      const dias = row.interval_days;
      toast.success(`${atual.artigo.rotulo}: volta em ${dias} dia${dias === 1 ? '' : 's'}.`);
      refreshHomeAfterSession(queryClient);
      setFeitas((n) => n + 1);
      setReveladas(new Set());
      setIdx((i) => i + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar revisão.');
    } finally {
      setSaving(false);
    }
  }

  if (fila === null) {
    return <div style={{ ...s.wrap, padding: 40 }}><p style={{ color: theme.inkFaint }}>Montando sua fila…</p></div>;
  }

  if (!atual) {
    return (
      <div style={{ ...s.wrap, padding: isMobile ? '24px 16px' : '40px' }}>
        <div style={s.doneBox}>
          <div style={{ fontSize: 40 }}>🎉</div>
          <h1 style={s.doneTitle}>
            {feitas > 0 ? `${feitas} artigo${feitas === 1 ? '' : 's'} revisado${feitas === 1 ? '' : 's'}!` : 'Nenhuma revisão de lei vencida'}
          </h1>
          <p style={s.doneSub}>
            {feitas > 0
              ? 'A lei seca agradece. Os intervalos foram reagendados.'
              : 'Grife artigos no Vade Mecum e ative a revisão para construir sua fila.'}
          </p>
          <button onClick={() => router.push('/vademecum')} style={s.doneBtn}>Voltar ao Vade Mecum</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...s.wrap, padding: isMobile ? '20px 14px' : '30px 40px' }}>
      <div style={s.topo}>
        <button onClick={() => router.push('/vademecum')} style={s.voltar}>← Vade Mecum</button>
        <span style={s.progresso}>{idx + 1} de {fila.length}</span>
      </div>

      <div style={s.card}>
        <div style={s.cardHead}>
          <span style={s.leiChip}>{atual.lei.nomeCurto}</span>
          <span style={s.rotulo}>{atual.artigo.rotulo}</span>
          {atual.artigo.caminho && <span style={s.caminho}>{atual.artigo.caminho}</span>}
        </div>

        {temLacunas && (
          <p style={s.hint}>
            Tente completar as lacunas de memória — clique para revelar.
            <button onClick={() => setReveladas(new Set(grifos.map((g) => g.id)))} style={s.revelarTudo}>
              revelar tudo
            </button>
          </p>
        )}

        <div style={s.texto}>
          {atual.artigo.blocos.map((b) => (
            <p key={b.id} style={{ ...s.bloco, paddingLeft: b.nivel * 20 }}>
              {b.rotulo && <span style={s.blocoRotulo}>{b.rotulo} </span>}
              {segmentarBloco(b.texto, grifos, b.id).map((seg, i) => {
                if (!seg.grifo) return <span key={i}>{seg.texto}</span>;
                const aberta = reveladas.has(seg.grifo.id);
                if (!aberta) {
                  return (
                    <span
                      key={i}
                      onClick={() => setReveladas((prev) => new Set(prev).add(seg.grifo!.id))}
                      title="Clique para revelar"
                      style={s.lacuna}
                    >
                      {' '.repeat(Math.max(6, Math.min(seg.texto.length, 40)))}
                    </span>
                  );
                }
                const estiloSeg: CSSProperties = seg.grifo.estilo === 'sublinhado'
                  ? { borderBottom: `2px solid ${SUBLINHADO_COR}` }
                  : { background: GRIFO_CORES[seg.grifo.cor ?? 'regra'].bg, borderRadius: 3 };
                return <span key={i} style={estiloSeg}>{seg.texto}</span>;
              })}
            </p>
          ))}
        </div>

        <div style={s.ratings}>
          {RATINGS.map((r) => (
            <button
              key={r.value}
              onClick={() => avaliar(r.value)}
              disabled={saving}
              style={{ ...s.ratingBtn, borderColor: r.cor, color: r.cor }}
            >
              {RATING_LABEL[r.value]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  wrap: { maxWidth: 780, margin: '0 auto', fontFamily: theme.font },
  topo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  voltar: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  progresso: { fontSize: 13, fontWeight: 600, color: theme.inkSoft },
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, padding: '20px 22px' },
  cardHead: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 },
  leiChip: { fontSize: 11.5, fontWeight: 700, color: theme.teal, background: theme.tealBg, borderRadius: 999, padding: '3px 10px' },
  rotulo: { fontSize: 16, fontWeight: 700, color: theme.ink },
  caminho: { fontSize: 11.5, color: theme.inkFaint, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  hint: { fontSize: 12.5, color: theme.inkSoft, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  revelarTudo: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', padding: 0 },
  texto: { fontSize: 14.5, lineHeight: 1.9, color: theme.ink },
  bloco: { margin: '0 0 8px' },
  blocoRotulo: { fontWeight: 600, color: theme.inkSoft },
  lacuna: { background: theme.muted, borderRadius: 4, cursor: 'pointer', borderBottom: `1.5px dashed ${theme.inkFaint}` },
  ratings: { display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' },
  ratingBtn: { flex: 1, minWidth: 90, padding: '11px 8px', borderRadius: theme.radiusSm, borderWidth: 1.5, borderStyle: 'solid', background: 'transparent', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  doneBox: { textAlign: 'center', padding: '60px 20px' },
  doneTitle: { fontSize: 22, fontWeight: 700, color: theme.ink, margin: '10px 0 6px' },
  doneSub: { fontSize: 14, color: theme.inkSoft, margin: '0 0 20px' },
  doneBtn: { padding: '11px 22px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
