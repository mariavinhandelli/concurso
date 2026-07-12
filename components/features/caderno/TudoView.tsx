// components/features/caderno/TudoView.tsx
// Aba "Tudo" do hub Caderno: lista unificada de notas ricas (study_notes) +
// erros (notes), com busca global e filtros por tipo. Não altera dados — só
// agrega para leitura/navegação. Clicar num item pede ao hub que o abra na aba
// nativa (Anotações ou Erros). Vade Mecum/Juris entram aqui só na fase 2.
'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { listStudyNotes, type NotaKind } from '@/services/studyNotes.service';
import { listRecentNotes } from '@/services/notebook.service';
import { listAnotacoesLei } from '@/services/leiInteracoes.service';
import { listAnotacoesJuris } from '@/services/jurisInteracoes.service';
import { LEIS_CATALOG } from '@/services/leis.service';
import { KIND_CORES } from '@/components/features/caderno/notaCores';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';

// 'lei'/'juris' são anotações que vivem no Vade Mecum/Jurisprudências — aqui só
// aparecem para busca/leitura e o clique abre o artigo/julgado (não o Caderno).
type Fonte = 'nota' | 'erro' | 'lei' | 'juris';
type Tipo = NotaKind | 'erro' | 'lei' | 'juris';

interface Item {
  fonte: Fonte;
  id: string;
  title: string;
  preview: string;
  tipo: Tipo;
  topicName: string | null;
  updated: string;
  href?: string; // presente em lei/juris → navega direto
}

const TIPO_LABEL: Record<Tipo, string> = {
  resumo: 'Resumo', dica: 'Dica', esquema: 'Esquema', outro: 'Outro', erro: 'Erro', lei: 'Lei seca', juris: 'Juris',
};
const COR_EXTRA: Partial<Record<Tipo, { bg: string; ink: string }>> = {
  erro: { bg: theme.clayBg, ink: theme.clayDeep },
  lei: { bg: theme.tealBg, ink: theme.tealDeep },
  juris: { bg: theme.warnTint, ink: theme.warnDeep },
};

// Janela de erros exibida por padrão na visão unificada; a busca no módulo
// Erros cobre o histórico completo quando necessário.
const JANELA_ERROS_DIAS = 365;

const FILTROS: { value: 'all' | Tipo; label: string }[] = [
  { value: 'all', label: 'Tudo' },
  { value: 'resumo', label: 'Resumos' },
  { value: 'dica', label: 'Dicas' },
  { value: 'esquema', label: 'Esquemas' },
  { value: 'erro', label: 'Erros' },
  { value: 'lei', label: 'Lei seca' },
  { value: 'juris', label: 'Juris' },
];

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  if (d < 30) return `há ${d} dias`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function TudoView({ onAbrir }: { onAbrir: (item: { fonte: 'nota' | 'erro'; id: string }) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [itens, setItens] = useState<Item[] | null>(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'all' | Tipo>('all');

  useEffect(() => {
    let cancelled = false;
    const nomeCurtoPorSlug = new Map(LEIS_CATALOG.map((l) => [l.slug, l.nomeCurto]));
    Promise.all([
      listStudyNotes(),
      listRecentNotes(JANELA_ERROS_DIAS),
      listAnotacoesLei().catch(() => []),
      listAnotacoesJuris().catch(() => []),
    ])
      .then(([notas, erros, leiAnot, jurisAnot]) => {
        if (cancelled) return;
        const combinados: Item[] = [
          ...notas.map((n): Item => ({
            fonte: 'nota', id: n.id, title: n.title || 'Sem título',
            preview: (n.content_text ?? '').trim().slice(0, 140),
            tipo: n.kind, topicName: n.topicName, updated: n.updated_at,
          })),
          ...erros.map((e): Item => ({
            fonte: 'erro', id: e.id, title: e.title || '(sem título)',
            preview: (e.content_text ?? '').trim().slice(0, 140),
            tipo: 'erro', topicName: null, updated: e.updated_at,
          })),
          ...leiAnot.map((a): Item => {
            const [slug, numero] = a.artigoKey.split(':');
            return {
              fonte: 'lei', id: a.artigoKey, title: `Art. ${numero} · ${nomeCurtoPorSlug.get(slug) ?? slug}`,
              preview: a.anotacoes.trim().slice(0, 140), tipo: 'lei', topicName: null,
              updated: a.updated_at, href: `/vademecum/${slug}`,
            };
          }),
          ...jurisAnot.map((j): Item => ({
            fonte: 'juris', id: j.id, title: j.titulo || j.disciplina,
            preview: (j.interacao?.anotacoes ?? '').trim().slice(0, 140), tipo: 'juris',
            topicName: j.tribunal, updated: j.interacao?.updated_at ?? j.updated_at,
            href: `/jurisprudencias/${j.id}`,
          })),
        ];
        combinados.sort((a, b) => b.updated.localeCompare(a.updated));
        setItens(combinados);
      })
      .catch((err) => {
        if (!cancelled) { setItens([]); toast.error(err instanceof Error ? err.message : 'Erro ao carregar o caderno.'); }
      });
    return () => { cancelled = true; };
  }, [toast]);

  function abrir(i: Item) {
    if (i.href) { router.push(i.href); return; }         // lei/juris → abre no módulo nativo
    onAbrir({ fonte: i.fonte as 'nota' | 'erro', id: i.id }); // nota/erro → aba do hub
  }

  const filtrados = useMemo(() => {
    let out = itens ?? [];
    if (filtro !== 'all') out = out.filter((i) => i.tipo === filtro);
    const termo = busca.trim().toLowerCase();
    if (termo) {
      out = out.filter((i) =>
        i.title.toLowerCase().includes(termo) || i.preview.toLowerCase().includes(termo));
    }
    return out;
  }, [itens, filtro, busca]);

  return (
    <div style={s.wrap}>
      <div style={s.tools}>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar em tudo que você escreveu…"
          style={s.busca}
          aria-label="Buscar no caderno"
        />
        <div style={s.chips}>
          {FILTROS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFiltro(f.value)}
              style={{ ...s.chip, ...(filtro === f.value ? s.chipOn : {}) }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {itens === null ? (
        <p style={s.muted}>Abrindo seu caderno…</p>
      ) : filtrados.length === 0 ? (
        <div style={s.vazioBox}>
          <p style={s.vazioTitulo}>{busca || filtro !== 'all' ? 'Nada encontrado.' : 'Você ainda não escreveu nada.'}</p>
          <p style={s.vazioSub}>Anotações e erros aparecem aqui, juntos. Use as abas para criar.</p>
        </div>
      ) : (
        <div style={s.list}>
          {filtrados.map((i) => {
            const cor = COR_EXTRA[i.tipo] ?? KIND_CORES[i.tipo as NotaKind];
            return (
              <button key={`${i.fonte}-${i.id}`} onClick={() => abrir(i)} style={s.card}>
                <span style={s.titulo}>{i.title}</span>
                {i.preview && <span style={s.preview}>{i.preview}</span>}
                <span style={s.metaRow}>
                  <span style={{ ...s.chipTipo, background: cor.bg, color: cor.ink }}>{TIPO_LABEL[i.tipo]}</span>
                  {i.topicName && <span style={s.topico}>{i.topicName}</span>}
                  <span style={s.quando}>{fmtRelative(i.updated)}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  wrap: { maxWidth: 720, minWidth: 0 },
  tools: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 },
  busca: { width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: { padding: '6px 13px', borderRadius: theme.radiusPill, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  chipOn: { background: theme.tealBg, borderColor: theme.teal, color: theme.tealDeep },

  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: { display: 'flex', flexDirection: 'column', gap: 4, width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, cursor: 'pointer', fontFamily: 'inherit', minWidth: 0 },
  titulo: { fontSize: 14, fontWeight: 700, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  preview: { fontSize: 13, color: theme.inkSoft, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' },
  metaRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, minWidth: 0 },
  chipTipo: { fontSize: 10, fontWeight: 700, borderRadius: theme.radiusPill, padding: '2px 8px', flexShrink: 0 },
  topico: { fontSize: 11, color: theme.inkFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  quando: { fontSize: 11, color: theme.inkFaint, marginLeft: 'auto', flexShrink: 0 },

  muted: { fontSize: 13, color: theme.inkFaint, padding: '16px 4px' },
  vazioBox: { textAlign: 'center', padding: '40px 12px' },
  vazioTitulo: { fontSize: 15, fontWeight: 700, color: theme.ink, margin: '0 0 6px' },
  vazioSub: { fontSize: 13, color: theme.inkSoft, lineHeight: 1.55, maxWidth: 340, margin: '0 auto' },
};
