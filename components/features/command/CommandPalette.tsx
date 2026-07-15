// components/features/command/CommandPalette.tsx
// Command Palette global (M2): Ctrl/Cmd+K abre uma busca única que navega para
// qualquer página, executa ações rápidas e pesquisa conteúdo (matérias, tópicos
// e leis) — o gesto de "power user" que substitui as 9 buscas locais quando o
// usuário sabe o que quer. Montado uma vez no AppShell; sem dependência de
// contexto além do router. Ações que exigem modais (Quick-Log) são disparadas
// por CustomEvent que a Topbar escuta.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { listSubjects, type Subject } from '@/services/subjects.service';
import { listAllTopics, type Topic } from '@/services/topics.service';
import { listNotes, type ErrorNote } from '@/services/notebook.service';
import { LEIS_CATALOG } from '@/services/leis.service';
import { listCatalogEditais, type CatalogEdital } from '@/services/editaisCatalog.service';
import { type JurisComInteracao } from '@/services/jurisInteracoes.service';
import { listFavoriteLeiArtigos } from '@/services/leiInteracoes.service';
import { getRecents } from '@/lib/recents';
import { theme, zIndex } from '@/lib/theme';

export const OPEN_COMMAND_EVENT = 'focali:open-command';
export const OPEN_QUICKLOG_EVENT = 'focali:open-quicklog';

type Group = 'Recentes' | 'Favoritos' | 'Ações' | 'Ir para' | 'Matérias' | 'Tópicos' | 'Leis' | 'Erros' | 'Editais';

interface CmdItem {
  key: string;
  group: Group;
  label: string;
  sublabel?: string;
  searchText?: string;  // texto extra pesquisável mas não exibido (ex: corpo do erro)
  swatch?: string;      // bolinha colorida (matéria)
  run: () => void;
}

// Remove acentos e caixa para casar "orcamento" com "Orçamento".
function norm(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

// Rotas navegáveis — espelha a sidebar + itens de conta.
const NAV: { label: string; href: string }[] = [
  { label: 'Home', href: '/' },
  { label: 'Revisões', href: '/revisar' },
  { label: 'Flashcards', href: '/flashcards' },
  { label: 'Agenda', href: '/schedule' },
  { label: 'Calendário', href: '/schedule?view=mes' },
  { label: 'Matérias', href: '/subjects' },
  { label: 'Editais', href: '/targets' },
  { label: 'Jurisprudências', href: '/jurisprudencias' },
  { label: 'Vade Mecum', href: '/vademecum' },
  { label: 'Caderno', href: '/caderno' },
  { label: 'Cadernos de erros', href: '/caderno?tab=erros' },
  { label: 'Performance', href: '/performance' },
  { label: 'Conquistas', href: '/conquistas' },
  { label: 'Histórico', href: '/historico' },
  { label: 'Meu perfil', href: '/profile' },
  { label: 'Configurações', href: '/settings' },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => { setOpen(false); setQ(''); setActive(0); }, []);

  // Abre por atalho (Ctrl/Cmd+K) ou por evento (botão de busca na Topbar).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onOpenEvent() { setOpen(true); }
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_COMMAND_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_COMMAND_EVENT, onOpenEvent);
    };
  }, []);

  // Foca o input ao abrir.
  useEffect(() => {
    if (open) { const t = setTimeout(() => inputRef.current?.focus(), 20); return () => clearTimeout(t); }
  }, [open]);

  // Conteúdo do usuário — carregado só quando o palette abre (e cacheado).
  const { data: subjects } = useQuery<Subject[]>({
    queryKey: ['cmd-subjects'], queryFn: listSubjects, enabled: open, staleTime: 60_000,
  });
  const { data: topics } = useQuery<Topic[]>({
    queryKey: ['cmd-topics'], queryFn: listAllTopics, enabled: open, staleTime: 60_000,
  });
  // Caderno de erros na busca — "peculato" precisa achar o erro, não só o tópico.
  const { data: erros } = useQuery<ErrorNote[]>({
    queryKey: ['cmd-erros'], queryFn: () => listNotes(), enabled: open, staleTime: 60_000,
  });
  // Editais do banco — "PM-GO" precisa achar a página do edital.
  const { data: catalogEditais } = useQuery<CatalogEdital[]>({
    queryKey: ['catalog-editais'], queryFn: listCatalogEditais, enabled: open, staleTime: 60_000,
  });

  // M12: Recentes (client-side, lidos a cada abertura) + Favoritos (juris + lei).
  const recents = useMemo(() => (open ? getRecents() : []), [open]);
  // Perf F1: import dinâmico — listFavoritas puxa data/jurisprudencias (~766KB).
  // Como só roda ao abrir o palette (enabled: open), vira um chunk à parte em vez
  // de entrar no bundle compartilhado (AppShell → toda página, incl. Home).
  const { data: jurisFavs } = useQuery<JurisComInteracao[]>({
    queryKey: ['cmd-fav-juris'], enabled: open, staleTime: 60_000,
    queryFn: async () => (await import('@/services/jurisInteracoes.service')).listFavoritas(),
  });
  const { data: leiFavs } = useQuery<{ artigoKey: string }[]>({
    queryKey: ['cmd-fav-lei'], queryFn: listFavoriteLeiArtigos, enabled: open, staleTime: 60_000,
  });

  const subjById = useMemo(() => {
    const m = new Map<string, Subject>();
    for (const s of subjects ?? []) m.set(s.id, s);
    return m;
  }, [subjects]);

  const go = useCallback((href: string) => { close(); router.push(href); }, [close, router]);

  // Itens estáticos (sempre disponíveis).
  const staticItems: CmdItem[] = useMemo(() => [
    { key: 'act-revisar', group: 'Ações', label: 'Iniciar revisão', sublabel: 'fila única de hoje', run: () => go('/revisar') },
    { key: 'act-quicklog', group: 'Ações', label: 'Registrar questões', sublabel: 'total + acertos, em segundos', run: () => { close(); window.dispatchEvent(new CustomEvent(OPEN_QUICKLOG_EVENT)); } },
    ...NAV.map((n): CmdItem => ({ key: `nav-${n.href}`, group: 'Ir para', label: n.label, run: () => go(n.href) })),
    ...LEIS_CATALOG.map((l): CmdItem => ({ key: `lei-${l.slug}`, group: 'Leis', label: l.nomeCurto, sublabel: l.nome, run: () => go(`/vademecum/${l.slug}`) })),
  ], [go, close]);

  const dynamicItems: CmdItem[] = useMemo(() => {
    const subs = (subjects ?? []).map((s): CmdItem => ({
      key: `subj-${s.id}`, group: 'Matérias', label: s.name, swatch: s.color, run: () => go(`/subjects/${s.id}`),
    }));
    const tops = (topics ?? []).map((t): CmdItem => {
      const subj = subjById.get(t.subject_id);
      return {
        key: `top-${t.id}`, group: 'Tópicos', label: t.name,
        sublabel: subj?.name, swatch: subj?.color,
        run: () => go(`/subjects/${t.subject_id}`),
      };
    });
    const errs = (erros ?? []).map((e): CmdItem => {
      const subj = e.subject_id ? subjById.get(e.subject_id) : undefined;
      return {
        key: `err-${e.id}`, group: 'Erros',
        label: e.title || 'Erro sem título',
        sublabel: [e.error_type, subj?.name].filter(Boolean).join(' · ') || undefined,
        searchText: e.content_text ?? undefined,
        swatch: subj?.color,
        run: () => go(`/caderno?erro=${e.id}`),
      };
    });
    const edits = (catalogEditais ?? []).map((e): CmdItem => ({
      key: `edital-${e.id}`, group: 'Editais',
      label: [e.orgao, e.cargo].filter(Boolean).join(' · '),
      sublabel: e.banca ?? e.areaName ?? undefined,
      run: () => go(`/editais/${e.slug}`),
    }));
    return [...subs, ...tops, ...errs, ...edits];
  }, [subjects, topics, erros, catalogEditais, subjById, go]);

  const recentItems: CmdItem[] = useMemo(() => recents.map((r): CmdItem => ({
    key: `rec-${r.kind}-${r.id}`, group: 'Recentes', label: r.label, sublabel: r.sublabel, run: () => go(r.href),
  })), [recents, go]);

  const favItems: CmdItem[] = useMemo(() => {
    const j = (jurisFavs ?? []).map((f): CmdItem => ({
      key: `favj-${f.id}`, group: 'Favoritos', label: f.titulo || f.disciplina, sublabel: f.tribunal, run: () => go(`/jurisprudencias/${f.id}`),
    }));
    const nomeCurto = new Map(LEIS_CATALOG.map((l) => [l.slug, l.nomeCurto]));
    const leis = (leiFavs ?? []).map((f): CmdItem => {
      const [slug, numero] = f.artigoKey.split(':');
      return { key: `favl-${f.artigoKey}`, group: 'Favoritos', label: `Art. ${numero} · ${nomeCurto.get(slug) ?? slug}`, run: () => go(`/vademecum/${slug}`) };
    });
    return [...j, ...leis];
  }, [jurisFavs, leiFavs, go]);

  // Filtro + limites por grupo. Query vazia → só Ações + navegação (menu enxuto).
  const results = useMemo(() => {
    const nq = norm(q.trim());
    // Busca vazia → o "home base": Recentes + Favoritos + Ações + navegação.
    if (!nq) {
      return [
        ...recentItems,
        ...favItems.slice(0, 6),
        ...staticItems.filter((i) => i.group === 'Ações' || i.group === 'Ir para'),
      ];
    }
    const all = [...staticItems, ...dynamicItems].filter((i) =>
      norm(i.label).includes(nq)
      || (i.sublabel ? norm(i.sublabel).includes(nq) : false)
      || (i.searchText ? norm(i.searchText).includes(nq) : false),
    );
    // Ordena por grupo e limita os grupos "grandes" para manter a lista navegável.
    const order: Group[] = ['Ações', 'Ir para', 'Matérias', 'Tópicos', 'Erros', 'Editais', 'Leis'];
    const caps: Record<Group, number> = { 'Recentes': 8, 'Favoritos': 8, 'Ações': 5, 'Ir para': 8, 'Matérias': 6, 'Tópicos': 8, 'Erros': 6, 'Editais': 5, 'Leis': 5 };
    const out: CmdItem[] = [];
    for (const g of order) out.push(...all.filter((i) => i.group === g).slice(0, caps[g]));
    return out;
  }, [q, staticItems, dynamicItems, recentItems, favItems]);

  // Reseta a seleção quando a busca muda — padrão "ajuste durante o render"
  // (evita o efeito em cascata de setState dentro de useEffect).
  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) { setPrevQ(q); setActive(0); }

  // Rola o item ativo para dentro da vista.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); results[active]?.run(); }
  }

  if (!open) return null;

  // Agrupa para render com cabeçalhos, mantendo o índice global para o teclado.
  let runningIdx = -1;
  const groupsInOrder: Group[] = ['Recentes', 'Favoritos', 'Ações', 'Ir para', 'Matérias', 'Tópicos', 'Erros', 'Editais', 'Leis'];

  return (
    <div style={s.backdrop} onClick={close}>
      <div style={s.panel} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Busca de comandos">
        <div style={s.inputRow}>
          <Search size={18} color={theme.inkFaint} strokeWidth={2} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Buscar páginas, matérias, tópicos, leis…"
            style={s.input}
            aria-label="Buscar"
          />
          <kbd style={s.esc}>esc</kbd>
        </div>

        <div ref={listRef} style={s.list}>
          {results.length === 0 ? (
            <div style={s.empty}>Nada encontrado para “{q}”.</div>
          ) : (
            groupsInOrder.map((g) => {
              const items = results.filter((i) => i.group === g);
              if (items.length === 0) return null;
              return (
                <div key={g}>
                  <div style={s.groupLabel}>{g}</div>
                  {items.map((it) => {
                    runningIdx += 1;
                    const idx = runningIdx;
                    const isActive = idx === active;
                    return (
                      <button
                        key={it.key}
                        data-idx={idx}
                        onMouseMove={() => setActive(idx)}
                        onClick={it.run}
                        style={{ ...s.item, background: isActive ? theme.muted : 'transparent' }}
                      >
                        {it.swatch
                          ? <span style={{ ...s.swatch, background: it.swatch }} />
                          : <span style={s.dot} />}
                        <span style={s.itemLabel}>{it.label}</span>
                        {it.sublabel && <span style={s.itemSub}>{it.sublabel}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div style={s.footer}>
          <span><kbd style={s.k}>↑</kbd><kbd style={s.k}>↓</kbd> navegar</span>
          <span><kbd style={s.k}>↵</kbd> abrir</span>
          <span><kbd style={s.k}>ctrl</kbd><kbd style={s.k}>K</kbd> abrir/fechar</span>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  backdrop: { position: 'fixed', inset: 0, zIndex: zIndex.dialog, background: 'var(--backdrop)', backdropFilter: 'blur(2px)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '12vh 16px 16px', fontFamily: theme.font },
  panel: { width: 'min(560px, 100%)', maxHeight: '70vh', background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadowHover, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  inputRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `0.5px solid ${theme.line}` },
  input: { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, color: theme.ink, fontFamily: 'inherit' },
  esc: { fontSize: 11, fontWeight: 600, color: theme.inkFaint, border: `0.5px solid ${theme.line}`, borderRadius: 5, padding: '2px 6px', background: theme.muted },
  list: { overflowY: 'auto', padding: 6, minHeight: 0 },
  empty: { padding: '28px 16px', textAlign: 'center', color: theme.inkFaint, fontSize: 14 },
  groupLabel: { fontSize: 11, fontWeight: 700, color: theme.inkFaint, letterSpacing: 0.7, textTransform: 'uppercase', padding: '10px 10px 4px' },
  item: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', background: 'transparent' },
  swatch: { width: 9, height: 9, borderRadius: 3, flexShrink: 0 },
  dot: { width: 5, height: 5, borderRadius: theme.radiusPill, background: theme.inkFaint, flexShrink: 0, margin: '0 2px' },
  itemLabel: { fontSize: 14, color: theme.ink, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1, minWidth: 0 },
  itemSub: { fontSize: 12, color: theme.inkFaint, marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0, paddingLeft: 8 },
  footer: { display: 'flex', gap: 16, padding: '8px 14px', borderTop: `0.5px solid ${theme.line}`, fontSize: 12, color: theme.inkFaint },
  k: { fontFamily: 'ui-monospace, monospace', fontSize: 11, padding: '1px 5px', borderRadius: 4, border: `0.5px solid ${theme.line}`, background: theme.muted, color: theme.inkSoft, marginRight: 3 },
};
