'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Sparkles } from 'lucide-react';
import { parseEdital } from '@/lib/parse-edital';
import { importEditalAsTarget } from '@/services/editalImport.service';
import {
  activateCatalogEdital, listCatalogEditais, matchCatalogEdital, type CatalogEdital,
} from '@/services/editaisCatalog.service';
import { track, EV } from '@/lib/analytics';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';
import { Overlay } from '@/components/ui/Overlay';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';

export function ImportarEditalModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (targetId: string) => void;
}) {
  const toast = useToast();
  const [orgao, setOrgao] = useState('');
  const [cargo, setCargo] = useState('');
  const [raw, setRaw] = useState('');
  const [saving, setSaving] = useState(false);

  const groups = useMemo(() => parseEdital(raw), [raw]);
  const totalTopics = groups.reduce((acc, g) => acc + g.topics.length, 0);

  // Fase 3: se órgão+cargo casam com um edital do banco, oferecer a ativação
  // completa em vez de criar um target órfão (sem ficha nem linha do tempo).
  const [activatingMatch, setActivatingMatch] = useState(false);
  const { data: catalogEditais } = useQuery<CatalogEdital[]>({
    queryKey: ['catalog-editais'],
    queryFn: listCatalogEditais,
    staleTime: 60_000,
  });
  const catalogMatch = useMemo(
    () => matchCatalogEdital(catalogEditais ?? [], orgao, cargo),
    [catalogEditais, orgao, cargo],
  );

  async function handleActivateMatch() {
    if (!catalogMatch || activatingMatch) return;
    setActivatingMatch(true);
    try {
      const targetId = await activateCatalogEdital(catalogMatch.id);
      track(EV.editalActivated, { slug: catalogMatch.slug, via: 'import_paste_match' });
      onImported(targetId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao ativar edital do banco.');
      setActivatingMatch(false);
    }
  }

  async function handleConfirm() {
    if (groups.length === 0) return;
    setSaving(true);
    try {
      // Match com o banco: o concurso importado nasce vinculado ao catálogo
      // (ficha, linha do tempo e notificações), mantendo a grade colada.
      const targetId = await importEditalAsTarget({
        orgao, cargo, groups,
        catalog_edital_id: catalogMatch?.id ?? null,
      });
      onImported(targetId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao importar edital.');
      setSaving(false);
    }
  }

  return (
    <Overlay onClose={onClose} maxWidth={680} labelledBy="importar-edital-title" hideClose>
        <div style={s.head}>
          <div>
            <h2 id="importar-edital-title" style={s.h2}>Importar edital colado</h2>
            <p style={s.sub}>Cole o conteúdo programático. Disciplinas em CAIXA ALTA viram matérias; as linhas abaixo, tópicos.</p>
          </div>
          <IconButton onClick={onClose} aria-label="Fechar" size="sm" style={{ flexShrink: 0 }}><X size={16} strokeWidth={2} /></IconButton>
        </div>

        <div style={s.fields}>
          <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo (ex: Analista)" style={{ flex: 1, minWidth: 140 }} />
          <Input value={orgao} onChange={(e) => setOrgao(e.target.value)} placeholder="Órgão (opcional)" style={{ flex: 1, minWidth: 140 }} />
        </div>

        {catalogMatch && (
          <div style={s.matchBanner}>
            <Sparkles size={16} color={theme.teal} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={s.matchTitle}>Este concurso já está no Banco de Editais</p>
              <p style={s.matchHint}>
                {catalogMatch.subjectCount > 0 ? (
                  <>
                    <strong>{[catalogMatch.orgao, catalogMatch.cargo].filter(Boolean).join(' · ')}</strong> — ativar a
                    versão completa traz pesos das disciplinas, ficha, linha do tempo e notícias.
                  </>
                ) : (
                  <>
                    <strong>{[catalogMatch.orgao, catalogMatch.cargo].filter(Boolean).join(' · ')}</strong> — sua
                    importação será vinculada a ele: o concurso nasce com ficha, linha do tempo e notificações,
                    mantendo a grade colada aqui.
                  </>
                )}
              </p>
            </div>
            {catalogMatch.subjectCount > 0 && (
              <Button size="sm" onClick={handleActivateMatch} loading={activatingMatch} style={{ flexShrink: 0 }}>
                {catalogMatch.isActivated ? 'Abrir concurso' : 'Ativar edital do banco'}
              </Button>
            )}
          </div>
        )}

        <div style={s.split}>
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={'LÍNGUA PORTUGUESA\n1. Interpretação de textos\n2. Ortografia\n\nDIREITO CONSTITUCIONAL\n1. Princípios fundamentais\n2. Direitos e garantias'}
            style={{ flex: 1, minWidth: 240, minHeight: 240, lineHeight: 1.6 }}
            autoFocus
          />
          <div style={s.preview}>
            <div style={s.previewHeader}>
              {groups.length === 0 ? 'Pré-visualização' : `${groups.length} matéria(s) · ${totalTopics} tópicos`}
            </div>
            {groups.length === 0 ? (
              <p style={s.previewEmpty}>As matérias e tópicos detectados aparecem aqui.</p>
            ) : (
              <div style={s.groupList}>
                {groups.map((g, i) => (
                  <div key={i} style={s.groupItem}>
                    <span style={s.groupName}>{g.subject}</span>
                    <span style={s.groupCount}>{g.topics.length}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={s.actions}>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={groups.length === 0} loading={saving}>
            {saving ? 'Criando…' : groups.length === 0 ? 'Criar concurso' : `Criar concurso com ${groups.length} matéria(s)`}
          </Button>
        </div>
    </Overlay>
  );
}

const s: Record<string, CSSProperties> = {
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  h2: { fontSize: 18, fontWeight: 700, color: theme.ink, margin: 0 },
  sub: { fontSize: 13, color: theme.inkSoft, margin: '5px 0 0', lineHeight: 1.5 },

  fields: { display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' },

  matchBanner: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: theme.radiusSm, border: `1px solid ${theme.teal}`, background: theme.tealBg, marginBottom: 14, flexWrap: 'wrap' },
  matchTitle: { fontSize: 13, fontWeight: 700, color: theme.ink, margin: 0 },
  matchHint: { fontSize: 12, color: theme.inkSoft, margin: '3px 0 0', lineHeight: 1.5 },

  split: { display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' },
  preview: { flex: 1, minWidth: 200, minHeight: 240, maxHeight: 320, overflowY: 'auto', padding: 14, borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.muted },
  previewHeader: { fontSize: 12, fontWeight: 700, color: theme.inkSoft, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  previewEmpty: { fontSize: 13, color: theme.inkFaint, margin: 0 },
  groupList: { display: 'flex', flexDirection: 'column', gap: 6 },
  groupItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: theme.radiusXs, background: theme.card, border: `0.5px solid ${theme.line}` },
  groupName: { fontSize: 14, color: theme.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  groupCount: { fontSize: 12, color: theme.teal, fontWeight: 700, flexShrink: 0 },

  actions: { display: 'flex', gap: 12, justifyContent: 'flex-end' },
};
