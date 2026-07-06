// components/features/vademecum/ArtigoCard.tsx
// Um artigo do Vade Mecum: texto por blocos com grifos semânticos renderizados,
// barra de marcação ao selecionar trecho, popover para remover grifo,
// anotações pessoais e toggle de revisão espaçada.
'use client';

import { memo, useRef, useState, type CSSProperties } from 'react';
import type { LeiArtigo } from '@/services/leis.service';
import {
  addGrifo, removeGrifo, saveAnotacaoArtigo,
  ativarRevisaoArtigo, desativarRevisaoArtigo,
  type LeiInteracao, type LeiGrifo, type GrifoCor,
} from '@/services/leiInteracoes.service';
import { isJurisDue } from '@/lib/juris-review';
import {
  GRIFO_CORES, GRIFO_CORES_ORDEM, SUBLINHADO_COR,
  segmentarBloco, temSobreposicao, findBlocoSelecionado,
} from '@/lib/lei-grifos';
import type { LeiQuestao } from '@/services/leiQuestoes.service';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';

const INCIDENCIA_CHIP: Record<string, { label: string; bg: string; ink: string }> = {
  muito_alta: { label: 'incidência muito alta', bg: 'rgba(226,75,74,.12)',  ink: '#C03A39' },
  alta:       { label: 'incidência alta',       bg: 'rgba(239,159,39,.14)', ink: '#A96F10' },
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
  const rootRef = useRef<HTMLDivElement>(null);
  const [pendingSel, setPendingSel] = useState<PendingSel | null>(null);
  const [popover, setPopover] = useState<GrifoPopover | null>(null);
  const [notasOpen, setNotasOpen] = useState(false);
  const [notaDraft, setNotaDraft] = useState<string | null>(null);
  const [savingNota, setSavingNota] = useState(false);
  const [questaoOpen, setQuestaoOpen] = useState(false);
  const [questaoIdx, setQuestaoIdx] = useState(0);
  const [resposta, setResposta] = useState<boolean | null>(null);

  const grifos = interacao?.grifos ?? [];
  const emRevisao = interacao?.is_review_active ?? false;
  const revisaoVencida = emRevisao && isJurisDue(interacao?.next_review_date ?? null);

  // ── Seleção → barra de marcação ──────────────────────────────────────────
  function handleMouseUp(e: React.MouseEvent) {
    setPopover(null);
    if (!rootRef.current) { setPendingSel(null); return; }

    const resultado = findBlocoSelecionado(rootRef.current);
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

    const x = Math.min(e.clientX, window.innerWidth - 250);
    const y = Math.min(e.clientY + 14, window.innerHeight - 60);
    setPendingSel({ bloco: blocoId, start: resultado.start, end: resultado.end, x, y });
  }

  async function aplicarGrifo(cor: GrifoCor | null, estilo: 'grifo' | 'sublinhado') {
    if (!pendingSel) return;
    const { bloco, start, end } = pendingSel;
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
        {incChip && <span style={{ ...s.incChip, background: incChip.bg, color: incChip.ink }}>{incChip.label}</span>}
        {emRevisao && (
          <span style={{ ...s.revChip, ...(revisaoVencida ? s.revChipDue : {}) }}>
            {revisaoVencida ? '⏰ revisão vencida' : `🔁 ${diasAteRevisao()}`}
          </span>
        )}
      </div>

      {artigo.incidenciaNota && (
        <p style={s.incNota}>💡 {artigo.incidenciaNota}</p>
      )}

      <div onMouseUp={handleMouseUp} style={s.texto}>
        {artigo.blocos.map((b) => (
          <p key={b.id} style={{ ...s.bloco, paddingLeft: b.nivel * 22 }}>
            {b.rotulo && <span style={s.blocoRotulo}>{b.rotulo} </span>}
            <span data-bloco={b.id}>
              {segmentarBloco(b.texto, grifos, b.id).map((seg, i) => {
                if (!seg.grifo) return <span key={i}>{seg.texto}</span>;
                const estiloSeg: CSSProperties = seg.grifo.estilo === 'sublinhado'
                  ? { borderBottom: `2px solid ${SUBLINHADO_COR}`, cursor: 'pointer' }
                  : { background: GRIFO_CORES[seg.grifo.cor ?? 'regra'].bg, borderRadius: 3, cursor: 'pointer' };
                return (
                  <span
                    key={i}
                    style={estiloSeg}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPopover({
                        grifo: seg.grifo!,
                        x: Math.min(e.clientX, window.innerWidth - 230),
                        y: Math.min(e.clientY + 12, window.innerHeight - 60),
                      });
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

      <div style={s.footer}>
        <button
          onClick={() => { setNotasOpen((v) => !v); setNotaDraft(null); }}
          style={{ ...s.footBtn, ...(temNota ? s.footBtnOn : {}) }}
        >
          ✎ {temNota ? 'Anotações' : 'Anotar'}
        </button>
        <button onClick={toggleRevisao} style={{ ...s.footBtn, ...(emRevisao ? s.footBtnOn : {}) }}>
          🔁 {emRevisao ? 'Em revisão' : 'Revisar'}
        </button>
        {temQuestoes && (
          <button
            onClick={() => { setQuestaoOpen((v) => !v); setResposta(null); }}
            style={{ ...s.footBtn, ...(questaoOpen ? s.footBtnOn : {}) }}
          >
            ✓ Questão C/E {questoes!.length > 1 ? `(${questoes!.length})` : ''}
          </button>
        )}
        {temGrifos && <span style={s.grifoCount}>{grifos.length} marca{grifos.length === 1 ? '' : 'ções'}</span>}
      </div>

      {notasOpen && (
        <div style={s.notaBox}>
          <textarea
            value={notaDraft ?? interacao?.anotacoes ?? ''}
            onChange={(e) => setNotaDraft(e.target.value)}
            rows={3}
            placeholder="Sua anotação sobre este artigo…"
            style={s.notaInput}
          />
          <div style={s.notaActions}>
            <button onClick={() => { setNotasOpen(false); setNotaDraft(null); }} style={s.notaCancel}>Fechar</button>
            <button onClick={salvarNota} disabled={savingNota || notaDraft === null} style={s.notaSave}>
              {savingNota ? 'Salvando…' : 'Salvar'}
            </button>
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
              }}>
                {resposta === questaoAtual.gabarito ? '✓ Você acertou — ' : '✗ Você errou — '}
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
        <div style={{ ...s.toolbar, left: pendingSel.x, top: pendingSel.y }} onMouseUp={(e) => e.stopPropagation()}>
          {GRIFO_CORES_ORDEM.map((cor) => (
            <button
              key={cor}
              title={GRIFO_CORES[cor].label}
              aria-label={`Grifar: ${GRIFO_CORES[cor].label}`}
              onClick={() => aplicarGrifo(cor, 'grifo')}
              style={{ ...s.corBtn, background: GRIFO_CORES[cor].chip }}
            />
          ))}
          <span style={s.toolbarSep} />
          <button title="Sublinhar" aria-label="Sublinhar" onClick={() => aplicarGrifo(null, 'sublinhado')} style={s.subBtn}>S̲</button>
          <button title="Cancelar" aria-label="Cancelar" onClick={() => setPendingSel(null)} style={s.subBtn}>✕</button>
        </div>
      )}

      {/* Popover de grifo existente */}
      {popover && (
        <div style={{ ...s.toolbar, left: popover.x, top: popover.y }}>
          <span style={s.popLabel}>
            {popover.grifo.estilo === 'sublinhado' ? 'Sublinhado' : GRIFO_CORES[popover.grifo.cor ?? 'regra'].label}
          </span>
          <button onClick={() => handleRemoverGrifo(popover.grifo)} style={s.popRemove}>Remover</button>
          <button onClick={() => setPopover(null)} style={s.subBtn}>✕</button>
        </div>
      )}
    </div>
  );
});

const s: Record<string, CSSProperties> = {
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, padding: '16px 18px', marginBottom: 12, position: 'relative' },
  head: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 },
  rotulo: { fontSize: 15, fontWeight: 700, color: theme.ink },
  incChip: { fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '3px 9px' },
  revChip: { fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '3px 9px', background: theme.tealBg, color: theme.tealDeep, marginLeft: 'auto' },
  revChipDue: { background: 'rgba(226,75,74,.12)', color: '#C03A39' },
  incNota: { fontSize: 12.5, color: theme.inkSoft, background: theme.muted, borderRadius: theme.radiusSm, padding: '7px 10px', margin: '0 0 10px', lineHeight: 1.5 },
  texto: { fontSize: 14.5, lineHeight: 1.85, color: theme.ink },
  bloco: { margin: '0 0 8px' },
  blocoRotulo: { fontWeight: 600, color: theme.inkSoft },
  footer: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${theme.line}`, flexWrap: 'wrap' },
  footBtn: { border: `0.5px solid ${theme.line}`, background: 'transparent', color: theme.inkSoft, fontSize: 12.5, fontWeight: 600, borderRadius: 999, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' },
  footBtnOn: { borderColor: theme.teal, color: theme.tealDeep, background: theme.tealBg },
  grifoCount: { fontSize: 12, color: theme.inkFaint, marginLeft: 'auto' },
  notaBox: { marginTop: 10 },
  notaInput: { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 13.5, color: theme.ink, fontFamily: 'inherit', outline: 'none', resize: 'vertical' },
  notaActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  notaCancel: { padding: '7px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: 'transparent', color: theme.inkSoft, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  notaSave: { padding: '7px 14px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  questaoBox: { marginTop: 10, background: theme.bg, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, padding: '12px 14px' },
  questaoEnunciado: { fontSize: 13.5, color: theme.ink, lineHeight: 1.6, margin: '0 0 12px' },
  questaoBtns: { display: 'flex', gap: 8 },
  questaoBtnC: { flex: 1, padding: '9px 0', borderRadius: theme.radiusSm, border: `1.5px solid ${theme.ok}`, background: 'transparent', color: theme.ok, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  questaoBtnE: { flex: 1, padding: '9px 0', borderRadius: theme.radiusSm, border: `1.5px solid ${theme.danger}`, background: 'transparent', color: theme.danger, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  questaoResultado: { fontSize: 13, fontWeight: 600, borderRadius: theme.radiusSm, padding: '8px 12px', marginBottom: 8 },
  questaoResultadoOk: { background: theme.okBg, color: theme.okDeep },
  questaoResultadoErro: { background: theme.dangerBg, color: theme.danger },
  questaoComentario: { fontSize: 12.5, color: theme.inkSoft, lineHeight: 1.55, margin: '0 0 10px' },
  questaoProxima: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  toolbar: { position: 'fixed', zIndex: 70, display: 'flex', alignItems: 'center', gap: 6, background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: 12, padding: '7px 9px', boxShadow: theme.shadowHover },
  corBtn: { width: 22, height: 22, borderRadius: 7, border: 'none', cursor: 'pointer' },
  toolbarSep: { width: 1, height: 18, background: theme.line },
  subBtn: { border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '2px 4px' },
  popLabel: { fontSize: 12.5, fontWeight: 600, color: theme.ink, padding: '0 2px' },
  popRemove: { border: 'none', background: 'transparent', color: theme.danger, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
