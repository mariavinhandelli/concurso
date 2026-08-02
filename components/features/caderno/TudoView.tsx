// components/features/caderno/TudoView.tsx
// Aba "Tudo" do hub Caderno: lista unificada de notas ricas (study_notes) +
// erros (notes) + anotações de lei/juris, sobre o CadernoShell (rail de tipos |
// lista | preview). Não altera dados — agrega para leitura/navegação. O painel
// de preview mostra o item selecionado inteiro; "Abrir" leva ao destino nativo
// (aba Anotações/Erros via hub, ou o artigo/julgado no módulo de origem).
// Antes a aba era uma coluna única presa em 720px com o resto da tela vazio, e
// clicar já trocava de aba direto (perdia o contexto da lista).
'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { getStudyNote, listStudyNotes, type NotaKind } from '@/services/studyNotes.service';
import { getNote, listRecentNotes } from '@/services/notebook.service';
import { listAnotacoesLei } from '@/services/leiInteracoes.service';
import { listAnotacoesJuris } from '@/services/jurisInteracoes.service';
import { LEIS_CATALOG } from '@/services/leis.service';
import { CadernoShell } from '@/components/features/caderno/CadernoShell';
import { ItemCard } from '@/components/features/caderno/ItemCard';
import { ListPanel } from '@/components/features/caderno/ListPanel';
import { SubjectPill } from '@/components/features/caderno/SubjectPill';
import { KIND_CORES } from '@/components/features/caderno/notaCores';
import { useToast } from '@/components/ui/ToastProvider';
import { Skeleton } from '@/components/ui/Skeleton';
import { fmtRelative } from '@/lib/relative-time';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';

// Tiptap só entra no bundle quando uma nota/erro é aberta na prévia.
const RichPreview = dynamic(
  () => import('@/components/features/caderno/RichPreview').then((m) => ({ default: m.RichPreview })),
  { ssr: false },
);

// 'lei'/'juris' são anotações que vivem no Vade Mecum/Jurisprudências — aqui
// aparecem para busca/leitura e o "Abrir" navega ao artigo/julgado.
type Fonte = 'nota' | 'erro' | 'lei' | 'juris';
type Tipo = NotaKind | 'erro' | 'lei' | 'juris';

interface Item {
  fonte: Fonte;
  id: string;
  title: string;
  texto: string; // conteúdo integral (texto puro) — o card corta, o preview mostra tudo
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

function corDoTipo(tipo: Tipo): { bg: string; ink: string } {
  return COR_EXTRA[tipo] ?? KIND_CORES[tipo as NotaKind];
}

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

const ABRIR_LABEL: Record<Fonte, string> = {
  nota: 'Abrir na aba Anotações',
  erro: 'Abrir na aba Erros',
  lei: 'Abrir no Vade Mecum',
  juris: 'Abrir na jurisprudência',
};

export function TudoView({ onAbrir }: { onAbrir: (item: { fonte: 'nota' | 'erro'; id: string }) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [itens, setItens] = useState<Item[] | null>(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'all' | Tipo>('all');
  const [selecionadoKey, setSelecionadoKey] = useState<string | null>(null);

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
            texto: (n.content_text ?? '').trim(),
            tipo: n.kind, topicName: n.topicName, updated: n.updated_at,
          })),
          ...erros.map((e): Item => ({
            fonte: 'erro', id: e.id, title: e.title || '(sem título)',
            texto: (e.content_text ?? '').trim(),
            tipo: 'erro', topicName: null, updated: e.updated_at,
          })),
          ...leiAnot.map((a): Item => {
            const [slug, numero] = a.artigoKey.split(':');
            return {
              fonte: 'lei', id: a.artigoKey, title: `Art. ${numero} · ${nomeCurtoPorSlug.get(slug) ?? slug}`,
              texto: a.anotacoes.trim(), tipo: 'lei', topicName: null,
              updated: a.updated_at, href: `/vademecum/${slug}`,
            };
          }),
          ...jurisAnot.map((j): Item => ({
            fonte: 'juris', id: j.id, title: j.titulo || j.disciplina,
            texto: (j.interacao?.anotacoes ?? '').trim(), tipo: 'juris',
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
        i.title.toLowerCase().includes(termo) || i.texto.toLowerCase().includes(termo));
    }
    return out;
  }, [itens, filtro, busca]);

  const countPorTipo = useMemo(() => {
    const map = new Map<Tipo, number>();
    for (const i of itens ?? []) map.set(i.tipo, (map.get(i.tipo) ?? 0) + 1);
    return map;
  }, [itens]);

  const keyDe = (i: Item) => `${i.fonte}-${i.id}`;
  const selecionado = useMemo(
    () => filtrados.find((i) => keyDe(i) === selecionadoKey) ?? null,
    [filtrados, selecionadoKey],
  );

  // Conteúdo rico (JSON Tiptap) do item aberto — a lista só carrega o texto
  // puro (content_text); sem isto a prévia perdia negrito/marca-texto/listas
  // e as quebras da extração viravam buracos ("toda desconfigurada").
  const [richContent, setRichContent] = useState<{ key: string; content: object } | null>(null);
  useEffect(() => {
    if (!selecionado || (selecionado.fonte !== 'nota' && selecionado.fonte !== 'erro')) return;
    const key = keyDe(selecionado);
    let cancelled = false;
    const fetchFull = selecionado.fonte === 'nota'
      ? getStudyNote(selecionado.id).then((n) => n?.content ?? null)
      : getNote(selecionado.id).then((n) => n?.content ?? null);
    fetchFull
      .then((content) => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- resposta assíncrona do fetch
        if (!cancelled && content) setRichContent({ key, content });
      })
      .catch(() => { /* prévia cai no texto puro */ });
    return () => { cancelled = true; };
  }, [selecionado]);

  const rail = (
    <>
      {FILTROS.map((f) => (
        <SubjectPill
          className="touch-target"
          key={f.value}
          color={f.value === 'all' ? undefined : corDoTipo(f.value).ink}
          name={f.label}
          count={f.value === 'all' ? (itens?.length ?? 0) : (countPorTipo.get(f.value) ?? 0)}
          alwaysShowCount={f.value === 'all'}
          active={filtro === f.value}
          onClick={() => setFiltro(f.value)}
        />
      ))}
    </>
  );

  const lista = (
    <ListPanel
      busca={busca}
      onBusca={setBusca}
      placeholder="Buscar em tudo que você escreveu…"
    >
      {itens === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} height={72} borderRadius={12} />)}
        </div>
      ) : filtrados.length === 0 ? (
        <div style={s.vazioBox}>
          <p style={s.vazioTitulo}>{busca || filtro !== 'all' ? 'Nada encontrado.' : 'Você ainda não escreveu nada.'}</p>
          <p style={s.vazioSub}>Anotações e erros aparecem aqui, juntos. Use as abas para criar.</p>
        </div>
      ) : (
        filtrados.map((i) => {
          const cor = corDoTipo(i.tipo);
          return (
            <ItemCard
              key={keyDe(i)}
              title={i.title}
              preview={i.texto.slice(0, 130)}
              chip={{ label: TIPO_LABEL[i.tipo], bg: cor.bg, ink: cor.ink }}
              meta={[i.topicName]}
              when={i.updated}
              onClick={() => setSelecionadoKey(keyDe(i))}
            />
          );
        })
      )}
    </ListPanel>
  );

  const detalhe = selecionado ? (
    <div style={s.previewWrap}>
      <div style={s.previewHead}>
        <span style={{ ...s.previewChip, background: corDoTipo(selecionado.tipo).bg, color: corDoTipo(selecionado.tipo).ink }}>
          {TIPO_LABEL[selecionado.tipo]}
        </span>
        {selecionado.topicName && <span style={s.previewTopico}>{selecionado.topicName}</span>}
        <span style={s.previewQuando}>{fmtRelative(selecionado.updated)}</span>
      </div>
      <h3 style={s.previewTitulo}>{selecionado.title}</h3>
      {richContent?.key === keyDe(selecionado) ? (
        <div style={s.previewRich}><RichPreview content={richContent.content} /></div>
      ) : selecionado.texto ? (
        <p style={s.previewTexto}>{selecionado.texto}</p>
      ) : (
        <p style={s.muted}>Sem texto — o conteúdo completo está no destino.</p>
      )}
      <div style={s.previewAcoes}>
        <Button onClick={() => abrir(selecionado)}>
          {ABRIR_LABEL[selecionado.fonte]}
          <ArrowUpRight size={15} strokeWidth={2} style={{ marginLeft: 6, verticalAlign: -2 }} />
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <CadernoShell
      rail={rail}
      lista={lista}
      detalhe={detalhe}
      detalheAberto={selecionado !== null}
      onVoltar={() => setSelecionadoKey(null)}
      voltarLabel="Voltar para o Caderno"
    />
  );
}

const s: Record<string, CSSProperties> = {
  muted: { fontSize: 13, color: theme.inkFaint, padding: '16px 4px' },
  vazioBox: { textAlign: 'center', padding: '40px 12px' },
  vazioTitulo: { fontSize: 15, fontWeight: 700, color: theme.ink, margin: '0 0 6px' },
  vazioSub: { fontSize: 13, color: theme.inkSoft, lineHeight: 1.55, maxWidth: 340, margin: '0 auto' },

  previewWrap: { display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 },
  previewHead: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  previewChip: { fontSize: 10, fontWeight: 700, borderRadius: theme.radiusPill, padding: '2px 8px', flexShrink: 0 },
  previewTopico: { fontSize: 12, color: theme.inkFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  previewQuando: { fontSize: 12, color: theme.inkFaint, marginLeft: 'auto', flexShrink: 0 },
  previewTitulo: { fontSize: 20, fontWeight: 700, color: theme.ink, margin: 0, lineHeight: 1.3 },
  previewTexto: { fontSize: 14, color: theme.ink, lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
  previewRich: { fontSize: 15, color: theme.ink, lineHeight: 1.7, minWidth: 0 },
  previewAcoes: { marginTop: 6 },
};
