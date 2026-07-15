'use client';

// IA ativa — usuária sobe o PDF do edital, a IA extrai órgão/cargo/banca/ano/
// data da prova + matérias/tópicos, e a usuária revisa/edita antes de
// confirmar. Espelha o layout de ImportarEditalModal (colar texto), que
// continua existindo como fallback manual.

import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Upload, Sparkles } from 'lucide-react';
import { extractEditalFromPdf, type EditalExtraido } from '@/services/editalPdfExtraction.service';
import { importEditalAsTarget } from '@/services/editalImport.service';
import {
  activateCatalogEdital, listCatalogEditais, matchCatalogEdital, type CatalogEdital,
} from '@/services/editaisCatalog.service';
import { listAllBoards, createBoard } from '@/services/boards.service';
import { track, EV } from '@/lib/analytics';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';
import { Overlay } from '@/components/ui/Overlay';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

type Step = 'idle' | 'extracting' | 'preview';

function normalizeBanca(s: string): string {
  return s.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function ImportarEditalPdfModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (targetId: string) => void;
}) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('idle');
  const [saving, setSaving] = useState(false);

  const [extraido, setExtraido] = useState<EditalExtraido | null>(null);
  const [orgao, setOrgao] = useState('');
  const [cargo, setCargo] = useState('');
  const [ano, setAno] = useState('');
  const [examDate, setExamDate] = useState('');
  const [banca, setBanca] = useState('');
  const [matchedBoardId, setMatchedBoardId] = useState<string | null>(null);
  const [criarBanca, setCriarBanca] = useState(true);

  const totalTopics = useMemo(
    () => (extraido?.materias ?? []).reduce((acc, m) => acc + m.topicos.length, 0),
    [extraido],
  );

  // Fase 3: se o edital importado já existe no banco, oferecer a ativação
  // completa (ficha, pesos, linha do tempo) em vez de criar um target órfão.
  // O match é reativo — segue as edições de órgão/cargo feitas pela usuária.
  const [activatingMatch, setActivatingMatch] = useState(false);
  const { data: catalogEditais } = useQuery<CatalogEdital[]>({
    queryKey: ['catalog-editais'],
    queryFn: listCatalogEditais,
    enabled: step === 'preview',
    staleTime: 60_000,
  });
  const catalogMatch = useMemo(
    () => (step === 'preview' ? matchCatalogEdital(catalogEditais ?? [], orgao, cargo) : null),
    [step, catalogEditais, orgao, cargo],
  );

  async function handleActivateMatch() {
    if (!catalogMatch || activatingMatch) return;
    setActivatingMatch(true);
    try {
      const targetId = await activateCatalogEdital(catalogMatch.id);
      track(EV.editalActivated, { slug: catalogMatch.slug, via: 'import_pdf_match' });
      onImported(targetId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao ativar edital do banco.');
      setActivatingMatch(false);
    }
  }

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setStep('extracting');
    try {
      const [result, boards] = await Promise.all([extractEditalFromPdf(file), listAllBoards()]);
      setExtraido(result);
      setOrgao(result.orgao || '');
      setCargo(result.cargo || '');
      setAno(result.ano ? String(result.ano) : '');
      setExamDate(result.examDate || '');
      setBanca(result.banca || '');

      const alvo = normalizeBanca(result.banca || '');
      const match = alvo ? boards.find((b) => normalizeBanca(b.name) === alvo) : undefined;
      setMatchedBoardId(match?.id ?? null);
      setCriarBanca(!match);

      setStep('preview');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao extrair o edital.');
      setStep('idle');
    }
  }

  async function handleConfirm() {
    if (!extraido || extraido.materias.length === 0) return;
    setSaving(true);
    try {
      let boardId: string | null = matchedBoardId;
      if (!boardId && criarBanca && banca.trim()) {
        const board = await createBoard(banca.trim());
        boardId = board.id;
      }

      const targetId = await importEditalAsTarget({
        orgao,
        cargo,
        groups: extraido.materias.map((m) => ({ subject: m.nome, topics: m.topicos })),
        ano_alvo: ano ? Number(ano) : null,
        exam_date: examDate || null,
        board_id: boardId,
      });
      onImported(targetId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao importar edital.');
      setSaving(false);
    }
  }

  return (
    <Overlay onClose={onClose} maxWidth={680} labelledBy="importar-edital-pdf-title" hideClose>
      <div style={s.head}>
        <div>
          <h2 id="importar-edital-pdf-title" style={s.h2}>Importar edital em PDF</h2>
          <p style={s.sub}>Envie o PDF do edital — a IA extrai matérias, tópicos e os dados do concurso pra você revisar.</p>
        </div>
        <IconButton onClick={onClose} aria-label="Fechar" size="sm" style={{ flexShrink: 0 }}><X size={16} strokeWidth={2} /></IconButton>
      </div>

      {step === 'idle' && (
        <div style={s.dropzone}>
          <Upload size={28} strokeWidth={1.5} color={theme.inkFaint} />
          <p style={s.dropzoneText}>PDF do edital, até 10MB</p>
          <Button onClick={() => fileInput.current?.click()}>Escolher PDF</Button>
          <input ref={fileInput} type="file" accept="application/pdf" onChange={handlePick} style={{ display: 'none' }} />
        </div>
      )}

      {step === 'extracting' && (
        <div style={s.extracting}>
          <Spinner size={22} color={theme.teal} />
          <p style={s.extractingText}>Lendo o PDF com IA…</p>
        </div>
      )}

      {step === 'preview' && extraido && (
        <>
          {catalogMatch && (
            <div style={s.matchBanner}>
              <Sparkles size={16} color={theme.teal} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={s.matchTitle}>Este concurso já está no Banco de Editais</p>
                <p style={s.matchHint}>
                  <strong>{[catalogMatch.orgao, catalogMatch.cargo].filter(Boolean).join(' · ')}</strong> — ativar a
                  versão completa traz pesos das disciplinas, ficha, linha do tempo e notícias.
                </p>
              </div>
              <Button size="sm" onClick={handleActivateMatch} loading={activatingMatch} style={{ flexShrink: 0 }}>
                {catalogMatch.isActivated ? 'Abrir concurso' : 'Ativar edital do banco'}
              </Button>
            </div>
          )}

          <div style={s.fields}>
            <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo" style={{ flex: 1, minWidth: 140 }} />
            <Input value={orgao} onChange={(e) => setOrgao(e.target.value)} placeholder="Órgão" style={{ flex: 1, minWidth: 140 }} />
          </div>
          <div style={s.fields}>
            <Input value={ano} onChange={(e) => setAno(e.target.value.replace(/\D/g, ''))} placeholder="Ano" style={{ flex: 1, minWidth: 100 }} />
            <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
          </div>

          {banca.trim() && (
            <div style={s.bancaRow}>
              {matchedBoardId ? (
                <span style={s.bancaMatched}>Banca detectada: <strong>{banca}</strong> (já cadastrada)</span>
              ) : (
                <label style={s.bancaCreate}>
                  <input type="checkbox" checked={criarBanca} onChange={(e) => setCriarBanca(e.target.checked)} />
                  Criar banca <strong>{banca}</strong>?
                </label>
              )}
            </div>
          )}

          <div style={s.preview}>
            <div style={s.previewHeader}>
              {extraido.materias.length} matéria(s) · {totalTopics} tópicos
            </div>
            <div style={s.groupList}>
              {extraido.materias.map((m, i) => (
                <div key={i} style={s.groupItem}>
                  <span style={s.groupName}>{m.nome}</span>
                  <span style={s.groupCount}>{m.topicos.length}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div style={s.actions}>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        {step === 'preview' && (
          <Button onClick={handleConfirm} disabled={!extraido || extraido.materias.length === 0} loading={saving}>
            {saving ? 'Criando…' : `Criar concurso com ${extraido?.materias.length ?? 0} matéria(s)`}
          </Button>
        )}
      </div>
    </Overlay>
  );
}

const s: Record<string, CSSProperties> = {
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  h2: { fontSize: 18, fontWeight: 700, color: theme.ink, margin: 0 },
  sub: { fontSize: 13, color: theme.inkSoft, margin: '5px 0 0', lineHeight: 1.5 },

  dropzone: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 12px', borderRadius: theme.radiusSm, border: `1px dashed ${theme.line}`, marginBottom: 18 },
  dropzoneText: { fontSize: 13, color: theme.inkFaint, margin: 0 },

  extracting: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 12px', marginBottom: 18 },
  extractingText: { fontSize: 14, color: theme.inkSoft, margin: 0 },

  fields: { display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' },

  matchBanner: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: theme.radiusSm, border: `1px solid ${theme.teal}`, background: theme.tealBg, marginBottom: 14, flexWrap: 'wrap' },
  matchTitle: { fontSize: 13, fontWeight: 700, color: theme.ink, margin: 0 },
  matchHint: { fontSize: 12, color: theme.inkSoft, margin: '3px 0 0', lineHeight: 1.5 },

  bancaRow: { marginBottom: 14 },
  bancaMatched: { fontSize: 13, color: theme.inkSoft },
  bancaCreate: { fontSize: 13, color: theme.inkSoft, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' },

  preview: { minHeight: 100, maxHeight: 260, overflowY: 'auto', padding: 14, borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.muted, marginBottom: 18 },
  previewHeader: { fontSize: 12, fontWeight: 700, color: theme.inkSoft, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  groupList: { display: 'flex', flexDirection: 'column', gap: 6 },
  groupItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: theme.radiusXs, background: theme.card, border: `0.5px solid ${theme.line}` },
  groupName: { fontSize: 14, color: theme.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  groupCount: { fontSize: 12, color: theme.teal, fontWeight: 700, flexShrink: 0 },

  actions: { display: 'flex', gap: 12, justifyContent: 'flex-end' },
};
