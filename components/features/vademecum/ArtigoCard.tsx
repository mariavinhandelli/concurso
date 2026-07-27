// components/features/vademecum/ArtigoCard.tsx
// Um artigo do Vade Mecum: texto por blocos com grifos semânticos renderizados,
// barra de marcação ao selecionar trecho, popover para remover grifo,
// anotações pessoais e toggle de revisão espaçada.
'use client';

import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { AlarmClock, RefreshCw, Info, Pencil, Check, X, Star, Layers } from 'lucide-react';
import { LEIS_CATALOG, type LeiArtigo } from '@/services/leis.service';
import { createFlashcard } from '@/services/flashcards.service';
import { listSubjects } from '@/services/subjects.service';
import {
  addGrifo, removeGrifo, saveAnotacaoArtigo, toggleFavoritoArtigo,
  ativarRevisaoArtigo, desativarRevisaoArtigo,
  type LeiInteracao, type LeiGrifo, type GrifoCor,
} from '@/services/leiInteracoes.service';
import { useUI } from '@/components/layout/UIContext';
import { isJurisDue } from '@/lib/juris-review';
import {
  GRIFO_CORES, GRIFO_CORES_ORDEM, SUBLINHADO_COR,
  segmentarBloco, temSobreposicao, findBlocoSelecionado,
} from '@/lib/lei-grifos';
import type { LeiQuestao } from '@/services/leiQuestoes.service';
import { useToast } from '@/components/ui/ToastProvider';
import { theme, zIndex } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Textarea';

const INCIDENCIA_CHIP: Record<string, { label: string; bg: string; ink: string }> = {
  muito_alta: { label: 'incidência muito alta', bg: 'rgba(226,75,74,.12)',  ink: theme.danger },
  alta:       { label: 'incidência alta',       bg: 'rgba(239,159,39,.14)', ink: theme.warnDeep },
};

interface Props {
  artigo: LeiArtigo;
  interacao: LeiInteracao | null;
  onUpdate: (artigoKey: string, patch: Partial<LeiInteracao>) => void;
  questoes?: LeiQuestao[];
}

interface PendingSel {
  bloco: string;
  start: number;
  end: number;
  x: number;
  y: number;
}

interface GrifoPopover {
  grifo: LeiGrifo;
  x: number;
  y: number;
}

export const ArtigoCard = memo(function ArtigoCard({ artigo, interacao, onUpdate, questoes }: Props) {
  const toast = useToast();
  const { isMobile, isTablet } = useUI();
  const touch = isMobile || isTablet;
  const rootRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pendingSel, setPendingSel] = useState<PendingSel | null>(null);
  const [popover, setPopover] = useState<GrifoPopover | null>(null);
  const [notasOpen, setNotasOpen] = useState(false);
  const [notaDraft, setNotaDraft] = useState<string | null>(null);
  const [savingNota, setSavingNota] = useState(false);
  const [questaoOpen, setQuestaoOpen] = useState(false);
  const [questaoIdx, setQuestaoIdx] = useState(0);
  const [resposta, setResposta] = useState<boolean | null>(null);
  const [flashOpen, setFlashOpen] = useState(false);
  const [flashFront, setFlashFront] = useState('');
  const [flashBack, setFlashBack] = useState('');
  const [flashSaving, setFlashSaving] = useState(false);

  const grifos = interacao?.grifos ?? [];
  const emRevisao = interacao?.is_review_active ?? false;
  const revisaoVencida = emRevisao && isJurisDue(interacao?.next_review_date ?? null);
  // Recém-ativada (nunca avaliada): mostrar "vencida" em vermelho no instante
  // em que o usuário acabou de ligar a revisão parecia punição — é só a
  // primeira entrada na fila de hoje.
  const revisaoNova = revisaoVencida && (interacao?.repetitions ?? 0) === 0 && !interacao?.last_reviewed;
  const favorito = interacao?.favorito ?? false;

  // ── Seleção → barra de marcação ──────────────────────────────────────────
  // Ouve `selectionchange` (dispara no mouse E no toque, ao contrário de
  // `mouseup`, que nunca acontece ao selecionar por toque no tablet/mobile),
  // com debounce para esperar a seleção assentar. Cada card só trata a seleção
  // que começou dentro dele (âncora contida na raiz), evitando duas barras
  // quando um trecho cruza dois artigos. A barra é posicionada pelo retângulo
  // da própria seleção — não há coordenadas de mouse em toque.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    function processarSelecao() {
      const root = rootRef.current;
      if (!root) return;

      try {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !root.contains(sel.anchorNode)) {
          setPendingSel(null);
          return;
        }

        const resultado = findBlocoSelecionado(root);
        if (!resultado.ok) {
          setPendingSel(null);
          if (resultado.reason === 'multiplos') {
            toast.info('Selecione um trecho dentro de um mesmo dispositivo (caput, parágrafo ou inciso).');
          }
          return;
        }

        const blocoId = resultado.bloco.dataset.bloco!;
        if (temSobreposicao(grifos, blocoId, resultado.start, resultado.end)) {
          setPendingSel(null);
          toast.error('Esse trecho já cruza uma marcação existente. Remova-a primeiro.');
          return;
        }

        const rect = sel.getRangeAt(0).getBoundingClientRect();
        const x = Math.max(8, Math.min(rect.left, window.innerWidth - 250));
        const y = Math.min(rect.bottom + 12, window.innerHeight - 60);
        setPopover(null);
        setPendingSel({ bloco: blocoId, start: resultado.start, end: resultado.end, x, y });
      } catch {
        // Seleção anômala (comum em touch, Range com âncora/foco invertidos) —
        // não deixa exceção não tratada travar o card sem toolbar.
        setPendingSel(null);
      }
    }

    function onSelectionChange() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(processarSelecao, 250);
    }

    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      if (timer) clearTimeout(timer);
    };
  }, [grifos, toast]);

  // Fecha a toolbar de grifo e o popover ao clicar fora deles — sem isso, um
  // clique em "Anotar"/"Questão C/E" com a seleção do browser ainda "viva"
  // podia deixar a toolbar flutuante sobreposta à caixa recém-aberta.
  useEffect(() => {
    if (!pendingSel && !popover) return;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (toolbarRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setPendingSel(null);
      setPopover(null);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [pendingSel, popover]);

  async function aplicarGrifo(cor: GrifoCor | null, estilo: 'grifo' | 'sublinhado') {
    if (!pendingSel) return;
    const { bloco, start, end } = pendingSel;
    // Revalida contra o estado ATUAL de grifos — pendingSel pode ter sido
    // calculado antes de outro grifo ser salvo (nesta aba ou noutra) no
    // intervalo até o clique.
    if (temSobreposicao(grifos, bloco, start, end)) {
      setPendingSel(null);
      toast.error('Esse trecho passou a cruzar uma marcação existente. Selecione de novo.');
      return;
    }
    setPendingSel(null);
    window.getSelection()?.removeAllRanges();
    try {
      const novos = await addGrifo(artigo.key, { bloco, start, end, cor, estilo, nota: null });
      onUpdate(artigo.key, { grifos: novos });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar grifo.');
    }
  }

  async function handleRemoverGrifo(grifo: LeiGrifo) {
    setPopover(null);
    try {
      const novos = await removeGrifo(artigo.key, grifo.id);
      onUpdate(artigo.key, { grifos: novos });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover grifo.');
    }
  }

  // ── Anotações ─────────────────────────────────────────────────────────────
  async function salvarNota() {
    const texto = (notaDraft ?? '').trim();
    setSavingNota(true);
    try {
      await saveAnotacaoArtigo(artigo.key, texto);
      onUpdate(artigo.key, { anotacoes: texto || null });
      setNotaDraft(null);
      if (!texto) setNotasOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar anotação.');
    } finally {
      setSavingNota(false);
    }
  }

  // ── Favorito ──────────────────────────────────────────────────────────────
  async function toggleFavorito() {
    const novo = !favorito;
    onUpdate(artigo.key, { favorito: novo }); // otimista — reverte no erro
    try {
      await toggleFavoritoArtigo(artigo.key, novo);
    } catch (e) {
      onUpdate(artigo.key, { favorito: !novo });
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar favorito.');
    }
  }

  // ── Flashcard a partir do artigo ─────────────────────────────────────────
  // Fecha o ciclo ler → marcar → treinar sem sair do leitor: frente sugerida
  // com a referência da lei, verso pré-preenchido com os trechos grifados
  // (se houver) — o que você marcou é o que vale memorizar.
  function abrirFlashcard() {
    if (!flashOpen) {
      const nomeCurto = LEIS_CATALOG.find((l) => artigo.key.startsWith(l.slug + ':'))?.nomeCurto ?? '';
      const trechos = grifos
        .map((g) => {
          const bloco = artigo.blocos.find((b) => b.id === g.bloco);
          return bloco ? bloco.texto.slice(g.start, g.end).trim() : '';
        })
        .filter(Boolean);
      setFlashFront(`${nomeCurto} — ${artigo.rotulo}: `);
      setFlashBack(trechos.join('\n'));
    }
    setFlashOpen((v) => !v);
  }

  // Card criado aqui nascia sem matéria: sumia dos filtros de /flashcards e não
  // contava para a cobertura. Liga na matéria da aluna equivalente à disciplina
  // da lei — se ela não tiver essa matéria, segue sem vínculo (não inventa
  // taxonomia paralela).
  async function subjectIdDaLei(): Promise<string | null> {
    const meta = LEIS_CATALOG.find((l) => artigo.key.startsWith(l.slug + ':'));
    if (!meta) return null;
    try {
      const subjects = await listSubjects();
      const norm = (v: string) =>
        v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
          .replace(/\s*\([^)]*\)\s*$/, '').replace(/^direito\s+/, '').trim();
      const alvo = norm(meta.disciplina);
      const hit = subjects.find((s) => norm(s.name) === alvo)
        ?? subjects.find((s) => alvo.startsWith(norm(s.name) + ' '));
      return hit?.id ?? null;
    } catch {
      return null; // vincular é um bônus; nunca pode impedir a criação do card
    }
  }

  async function salvarFlashcard() {
    const front = flashFront.trim();
    const back = flashBack.trim();
    if (!front || !back) { toast.info('Preencha a frente e o verso do flashcard.'); return; }
    setFlashSaving(true);
    try {
      const subjectId = await subjectIdDaLei();
      await createFlashcard({ front, back, topicId: null, subjectId, sourceErrorId: null, addToReview: true });
      setFlashOpen(false);
      toast.success('Flashcard criado — ele já entra na sua fila de revisão.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar flashcard.');
    } finally {
      setFlashSaving(false);
    }
  }

  // ── Revisão espaçada ──────────────────────────────────────────────────────
  async function toggleRevisao() {
    try {
      if (emRevisao) {
        await desativarRevisaoArtigo(artigo.key);
        onUpdate(artigo.key, { is_review_active: false, next_review_date: null });
      } else {
        const row = await ativarRevisaoArtigo(artigo.key);
        onUpdate(artigo.key, {
          is_review_active: true,
          next_review_date: row.next_review_date,
          interval_days: row.interval_days,
          repetitions: row.repetitions,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar revisão.');
    }
  }

  function diasAteRevisao(): string {
    const d = interacao?.next_review_date;
    if (!d) return '';
    const alvo = new Date(d + 'T00:00:00');
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const diff = Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
    if (diff <= 0) return 'vence hoje';
    return diff === 1 ? 'volta amanhã' : `volta em ${diff} dias`;
  }

  const incChip = INCIDENCIA_CHIP[artigo.incidencia];
  const temGrifos = grifos.length > 0;
  const temNota = Boolean(interacao?.anotacoes);
  const temQuestoes = (questoes?.length ?? 0) > 0;
  const questaoAtual = temQuestoes ? questoes![questaoIdx % questoes!.length] : null;

  function proximaQuestao() {
    setResposta(null);
    setQuestaoIdx((i) => (temQuestoes ? (i + 1) % questoes!.length : 0));
  }

  return (
    <div ref={rootRef} id={`art-${artigo.numero}`} style={{ ...s.card, opacity: artigo.revogado ? 0.55 : 1 }}>
      <div style={s.head}>
        <span style={s.rotulo}>{artigo.rotulo}</span>
        {incChip && <Badge style={{ background: incChip.bg, color: incChip.ink }}>{incChip.label}</Badge>}
        {emRevisao && (
          <Badge
            variant={revisaoVencida && !revisaoNova ? 'danger' : 'brand'}
            style={{ marginLeft: 'auto' }}
          >
            {revisaoNova
              ? <><RefreshCw size={12} strokeWidth={2} />na fila de hoje</>
              : revisaoVencida
                ? <><AlarmClock size={12} strokeWidth={2} />revisão vencida</>
                : <><RefreshCw size={12} strokeWidth={2} />{diasAteRevisao()}</>}
          </Badge>
        )}
      </div>

      {artigo.incidenciaNota && (
        <p style={{ ...s.incNota, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <Info size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />{artigo.incidenciaNota}
        </p>
      )}

      <div style={s.texto}>
        {artigo.blocos.map((b) => (
          <p key={b.id} style={{ ...s.bloco, paddingLeft: b.nivel * 22 }}>
            {b.rotulo && <span style={s.blocoRotulo}>{b.rotulo} </span>}
            <span data-bloco={b.id}>
              {segmentarBloco(b.texto, grifos, b.id).map((seg, i) => {
                if (!seg.grifo) return <span key={i}>{seg.texto}</span>;
                const estiloSeg: CSSProperties = seg.grifo.estilo === 'sublinhado'
                  ? { borderBottom: `2px solid ${SUBLINHADO_COR}`, cursor: 'pointer' }
                  : { background: GRIFO_CORES[seg.grifo.cor ?? 'regra'].bg, borderRadius: 3, cursor: 'pointer' };
                const abrirPopover = (x: number, y: number) => setPopover({
                  grifo: seg.grifo!,
                  x: Math.min(x, window.innerWidth - 230),
                  y: Math.min(y + 12, window.innerHeight - 60),
                });
                return (
                  <span
                    key={i}
                    style={estiloSeg}
                    tabIndex={0}
                    role="button"
                    aria-label={`Grifo: ${seg.grifo.estilo === 'sublinhado' ? 'sublinhado' : GRIFO_CORES[seg.grifo.cor ?? 'regra'].label}. Ativar para remover.`}
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirPopover(e.clientX, e.clientY);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      e.stopPropagation();
                      const rect = (e.target as HTMLElement).getBoundingClientRect();
                      abrirPopover(rect.left, rect.bottom);
                    }}
                  >
                    {seg.texto}
                  </span>
                );
              })}
            </span>
          </p>
        ))}
      </div>

      <div style={{ ...s.footer, ...(touch ? s.footerTouch : {}) }}>
        <button
          onClick={() => { setNotasOpen((v) => !v); setNotaDraft(null); }}
          style={{ ...s.footBtn, ...(touch ? s.footBtnTouch : {}), ...(temNota ? s.footBtnOn : {}) }}
        >
          <Pencil size={13} strokeWidth={2} /> {temNota ? 'Anotações' : 'Anotar'}
        </button>
        <button onClick={toggleRevisao} style={{ ...s.footBtn, ...(touch ? s.footBtnTouch : {}), ...(emRevisao ? s.footBtnOn : {}) }}>
          <RefreshCw size={13} strokeWidth={2} /> {emRevisao ? 'Em revisão' : 'Revisar'}
        </button>
        <button
          onClick={toggleFavorito}
          aria-pressed={favorito}
          aria-label={favorito ? `Remover ${artigo.rotulo} dos favoritos` : `Favoritar ${artigo.rotulo}`}
          title={favorito ? 'Remover dos favoritos' : 'Favoritar — aparece na busca rápida (Ctrl+K)'}
          style={{ ...s.footBtn, ...(touch ? s.footBtnTouch : {}), ...(favorito ? s.footBtnOn : {}) }}
        >
          <Star size={13} strokeWidth={2} fill={favorito ? 'currentColor' : 'none'} /> {favorito ? 'Favorito' : 'Favoritar'}
        </button>
        <button
          onClick={abrirFlashcard}
          title="Criar flashcard deste artigo (verso pré-preenchido com seus grifos)"
          style={{ ...s.footBtn, ...(touch ? s.footBtnTouch : {}), ...(flashOpen ? s.footBtnOn : {}) }}
        >
          <Layers size={13} strokeWidth={2} /> Flashcard
        </button>
        {temQuestoes && (
          <button
            onClick={() => { setQuestaoOpen((v) => !v); setResposta(null); }}
            style={{ ...s.footBtn, ...(touch ? s.footBtnTouch : {}), ...(questaoOpen ? s.footBtnOn : {}) }}
          >
            <Check size={13} strokeWidth={2} /> Questão C/E {questoes!.length > 1 ? `(${questoes!.length})` : ''}
          </button>
        )}
        {temGrifos && (
          <span style={{ ...s.grifoCount, ...(touch ? s.grifoCountTouch : {}) }}>
            {grifos.length} marca{grifos.length === 1 ? '' : 'ções'}
          </span>
        )}
      </div>

      {notasOpen && (
        <div style={s.notaBox}>
          <Textarea
            value={notaDraft ?? interacao?.anotacoes ?? ''}
            onChange={(e) => setNotaDraft(e.target.value)}
            rows={3}
            placeholder="Sua anotação sobre este artigo…"
            style={{ fontSize: 14 }}
          />
          <div style={s.notaActions}>
            <Button variant="outline" size="sm" onClick={() => { setNotasOpen(false); setNotaDraft(null); }}>Fechar</Button>
            <Button size="sm" onClick={salvarNota} disabled={savingNota || notaDraft === null}>
              {savingNota ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      )}

      {flashOpen && (
        <div style={s.notaBox}>
          <Textarea
            value={flashFront}
            onChange={(e) => setFlashFront(e.target.value)}
            rows={2}
            placeholder={`Pergunta — ex.: O que diz o ${artigo.rotulo}?`}
            aria-label="Frente do flashcard"
            style={{ fontSize: 14 }}
          />
          <div style={{ height: 8 }} />
          <Textarea
            value={flashBack}
            onChange={(e) => setFlashBack(e.target.value)}
            rows={3}
            placeholder="Resposta — o que você precisa lembrar"
            aria-label="Verso do flashcard"
            style={{ fontSize: 14 }}
          />
          <div style={s.notaActions}>
            <Button variant="outline" size="sm" onClick={() => setFlashOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={salvarFlashcard} disabled={flashSaving}>
              {flashSaving ? 'Criando…' : 'Criar flashcard'}
            </Button>
          </div>
        </div>
      )}

      {questaoOpen && questaoAtual && (
        <div style={s.questaoBox}>
          <p style={s.questaoEnunciado}>{questaoAtual.enunciado}</p>
          {resposta === null ? (
            <div style={s.questaoBtns}>
              <button onClick={() => setResposta(true)} style={s.questaoBtnC}>Certo</button>
              <button onClick={() => setResposta(false)} style={s.questaoBtnE}>Errado</button>
            </div>
          ) : (
            <>
              <div style={{
                ...s.questaoResultado,
                ...(resposta === questaoAtual.gabarito ? s.questaoResultadoOk : s.questaoResultadoErro),
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {resposta === questaoAtual.gabarito ? <Check size={14} strokeWidth={2.5} /> : <X size={14} strokeWidth={2.5} />}
                {resposta === questaoAtual.gabarito ? 'Você acertou — ' : 'Você errou — '}
                gabarito: <b>{questaoAtual.gabarito ? 'Certo' : 'Errado'}</b>
              </div>
              <p style={s.questaoComentario}>{questaoAtual.comentario}</p>
              {questoes!.length > 1 && (
                <button onClick={proximaQuestao} style={s.questaoProxima}>Próxima questão →</button>
              )}
            </>
          )}
        </div>
      )}

      {/* Barra de marcação (aparece ao selecionar) */}
      {pendingSel && (
        <div ref={toolbarRef} style={{ ...s.toolbar, left: pendingSel.x, top: pendingSel.y }} onMouseUp={(e) => e.stopPropagation()}>
          {GRIFO_CORES_ORDEM.map((cor) => (
            <button
              key={cor}
              title={GRIFO_CORES[cor].label}
              aria-label={`Grifar: ${GRIFO_CORES[cor].label}`}
              onClick={() => aplicarGrifo(cor, 'grifo')}
              style={{ ...s.corBtn, ...(touch ? s.corBtnTouch : {}), background: GRIFO_CORES[cor].chip }}
            />
          ))}
          <span style={s.toolbarSep} />
          <button title="Sublinhar" aria-label="Sublinhar" onClick={() => aplicarGrifo(null, 'sublinhado')} style={s.subBtn}>S̲</button>
          <button title="Cancelar" aria-label="Cancelar" onClick={() => setPendingSel(null)} style={s.subBtn}><X size={14} strokeWidth={2} /></button>
        </div>
      )}

      {/* Popover de grifo existente */}
      {popover && (
        <div ref={popoverRef} style={{ ...s.toolbar, left: popover.x, top: popover.y }}>
          <span style={s.popLabel}>
            {popover.grifo.estilo === 'sublinhado' ? 'Sublinhado' : GRIFO_CORES[popover.grifo.cor ?? 'regra'].label}
          </span>
          <button onClick={() => handleRemoverGrifo(popover.grifo)} style={s.popRemove}>Remover</button>
          <button onClick={() => setPopover(null)} style={s.subBtn}><X size={14} strokeWidth={2} /></button>
        </div>
      )}
    </div>
  );
});

const s: Record<string, CSSProperties> = {
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, padding: '16px 18px', marginBottom: 12, position: 'relative' },
  head: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 },
  rotulo: { fontSize: 15, fontWeight: 700, color: theme.ink },
  incNota: { fontSize: 13, color: theme.inkSoft, background: theme.muted, borderRadius: theme.radiusSm, padding: '7px 10px', margin: '0 0 10px', lineHeight: 1.5 },
  texto: { fontSize: 15, lineHeight: 1.85, color: theme.ink },
  bloco: { margin: '0 0 8px' },
  blocoRotulo: { fontWeight: 600, color: theme.inkSoft },
  footer: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${theme.line}`, flexWrap: 'wrap' },
  // No celular as 5 ações com alvo de 44px quebravam em duas linhas — ~96px de
  // rodapé por artigo, numa lista de centenas. Uma única linha rolável (mesmo
  // padrão dos filtros da biblioteca) mantém rótulo e alvo de toque sem dobrar
  // a altura; no desktop segue com wrap, que ali cabe numa linha só.
  footerTouch: { flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' },
  footBtn: { border: `0.5px solid ${theme.line}`, background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 600, borderRadius: theme.radiusPill, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 },
  footBtnTouch: { minHeight: 44, padding: '5px 14px', flexShrink: 0, whiteSpace: 'nowrap' },
  footBtnOn: { borderColor: theme.teal, color: theme.tealDeep, background: theme.tealBg },
  grifoCount: { fontSize: 12, color: theme.inkFaint, marginLeft: 'auto' },
  grifoCountTouch: { marginLeft: 4, flexShrink: 0, whiteSpace: 'nowrap' },
  notaBox: { marginTop: 10 },
  notaActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  notaCancel: { padding: '7px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: 'transparent', color: theme.inkSoft, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  notaSave: { padding: '7px 14px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  questaoBox: { marginTop: 10, background: theme.bg, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, padding: '12px 14px' },
  questaoEnunciado: { fontSize: 14, color: theme.ink, lineHeight: 1.6, margin: '0 0 12px' },
  questaoBtns: { display: 'flex', gap: 8 },
  questaoBtnC: { flex: 1, padding: '9px 0', borderRadius: theme.radiusSm, border: `1.5px solid ${theme.ok}`, background: 'transparent', color: theme.ok, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  questaoBtnE: { flex: 1, padding: '9px 0', borderRadius: theme.radiusSm, border: `1.5px solid ${theme.danger}`, background: 'transparent', color: theme.danger, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  questaoResultado: { fontSize: 13, fontWeight: 600, borderRadius: theme.radiusSm, padding: '8px 12px', marginBottom: 8 },
  questaoResultadoOk: { background: theme.okBg, color: theme.okDeep },
  questaoResultadoErro: { background: theme.dangerBg, color: theme.danger },
  questaoComentario: { fontSize: 13, color: theme.inkSoft, lineHeight: 1.55, margin: '0 0 10px' },
  questaoProxima: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  toolbar: { position: 'fixed', zIndex: zIndex.menu, display: 'flex', alignItems: 'center', gap: 6, background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, padding: '7px 9px', boxShadow: theme.shadowHover },
  corBtn: { width: 22, height: 22, borderRadius: 7, border: 'none', cursor: 'pointer' },
  corBtnTouch: { width: 34, height: 34, borderRadius: 10 },
  toolbarSep: { width: 1, height: 18, background: theme.line },
  subBtn: { border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '2px 4px' },
  popLabel: { fontSize: 13, fontWeight: 600, color: theme.ink, padding: '0 2px' },
  popRemove: { border: 'none', background: 'transparent', color: theme.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
