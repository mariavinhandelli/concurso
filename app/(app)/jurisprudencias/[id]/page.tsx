'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getJurisprudencia, updateJurisprudencia, deleteJurisprudencia, getJurisprudenciaById,
  type Jurisprudencia, type JurisprudenciaInput,
} from '@/services/jurisprudencias.service';
import { JurisprudenciaDetail } from '@/components/features/jurisprudencias/JurisprudenciaDetail';
import { JurisprudenciaForm } from '@/components/features/jurisprudencias/JurisprudenciaForm';
import { JurisModoEstudo } from '@/components/features/jurisprudencias/JurisModoEstudo';
import { JurisInteracoesPanel } from '@/components/features/jurisprudencias/JurisInteracoesPanel';
import { EstrelasBadge } from '@/components/features/jurisprudencias/EstrelasBadge';
import { useToast } from '@/components/ui/ToastProvider';
import { useConfirm } from '@/hooks/useConfirm';
import { useUI } from '@/components/layout/UIContext';
import { theme } from '@/lib/theme';

const INCIDENCIA_LABEL: Record<string, string> = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', muito_alta: 'Muito Alta',
};
const TIPO_LABEL: Record<string, string> = {
  sumula: 'Súmula', sumula_vinculante: 'Súmula Vinculante', acordao: 'Acórdão', decisao_monocratica: 'Decisão Monocrática',
  informativo: 'Informativo', outro: 'Outro',
};

type Tab = 'leitura' | 'estudo' | 'pessoal';

export default function JurisprudenciaPage() {
  const params = useParams();
  const router = useRouter();
  const { isMobile } = useUI();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const id = params.id as string;
  const isStatic = !!getJurisprudenciaById(id);
  const [item, setItem] = useState<Jurisprudencia | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('leitura');

  // Navegação anterior/próxima seguindo a ordem da última lista visitada
  // (a lista grava os ids em sessionStorage a cada filtro/busca).
  const [navIds, setNavIds] = useState<string[]>([]);
  useEffect(() => {
    try { setNavIds(JSON.parse(sessionStorage.getItem('juris:navIds') ?? '[]')); } catch { /* json inválido */ }
  }, []);
  const navIdx = navIds.indexOf(id);
  const prevId = navIdx > 0 ? navIds[navIdx - 1] : null;
  const nextId = navIdx >= 0 && navIdx < navIds.length - 1 ? navIds[navIdx + 1] : null;

  // Atalhos ← → (ignorados durante edição ou digitação em campos).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editing) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft' && prevId) router.push(`/jurisprudencias/${prevId}`);
      if (e.key === 'ArrowRight' && nextId) router.push(`/jurisprudencias/${nextId}`);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, prevId, nextId, router]);

  const load = useCallback(async () => {
    try {
      const data = await getJurisprudencia(id);
      if (!data) { router.push('/jurisprudencias'); return; }
      setItem(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      setLoading(false);
    }
  }, [id, router, toast]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data: JurisprudenciaInput) {
    setSaving(true);
    try {
      const updated = await updateJurisprudencia(id, data);
      setItem(updated);
      setEditing(false);
      toast.success('Jurisprudência atualizada!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!await confirm({
      title: 'Apagar esta jurisprudência?',
      description: 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Apagar',
      danger: true,
    })) return;
    try {
      await deleteJurisprudencia(id);
      toast.success('Jurisprudência apagada.');
      router.push('/jurisprudencias');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao apagar.');
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '20px 16px' : '34px 40px' }}>
        <div style={{ height: 200, background: theme.card, borderRadius: theme.radius, border: `0.5px solid ${theme.line}`, animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />
      </div>
    );
  }

  if (!item) return null;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'leitura', label: 'Leitura' },
    { key: 'estudo', label: 'Modo estudo' },
    { key: 'pessoal', label: 'Minhas notas' },
  ];

  return (
    <>
      {dialog}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '20px 16px' : '34px 40px', fontFamily: theme.font, minWidth: 0 }}>

        {/* Navegação e ações */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <button
            onClick={() => router.push('/jurisprudencias')}
            style={{ border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
          >
            ← Jurisprudências
          </button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!editing && (prevId || nextId) && (
              <span style={{ display: 'inline-flex', gap: 4, marginRight: 4 }}>
                <button
                  onClick={() => prevId && router.push(`/jurisprudencias/${prevId}`)}
                  disabled={!prevId}
                  aria-label="Jurisprudência anterior"
                  aria-keyshortcuts="ArrowLeft"
                  style={{ ...styles.actionBtn, padding: '8px 12px', opacity: prevId ? 1 : 0.35 }}
                >‹ Anterior</button>
                <button
                  onClick={() => nextId && router.push(`/jurisprudencias/${nextId}`)}
                  disabled={!nextId}
                  aria-label="Próxima jurisprudência"
                  aria-keyshortcuts="ArrowRight"
                  style={{ ...styles.actionBtn, padding: '8px 12px', opacity: nextId ? 1 : 0.35 }}
                >Próxima ›</button>
              </span>
            )}
            {/* Itens do banco oficial (data/jurisprudencias.ts) não são editáveis:
                o update/delete iria para o Supabase e nunca refletiria na tela. */}
            {!editing && (isStatic ? (
              <span style={{
                fontSize: 12, fontWeight: 600, color: theme.inkFaint,
                border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusPill, padding: '5px 12px',
              }}>
                Banco oficial · somente leitura
              </span>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  style={styles.actionBtn}
                >
                  Editar
                </button>
                <button
                  onClick={handleDelete}
                  style={styles.actionBtnDanger}
                >
                  Apagar
                </button>
              </>
            ))}
          </div>
        </div>

        {/* Cabeçalho */}
        {!editing && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: theme.teal, borderRadius: 6, padding: '3px 10px' }}>
                {item.tribunal}
              </span>
              <span style={{ fontSize: 12, color: theme.inkSoft, background: 'rgba(15,23,42,.06)', borderRadius: 6, padding: '3px 10px' }}>
                {TIPO_LABEL[item.tipo] ?? item.tipo}
              </span>
              {item.informativo && (
                <span style={{ fontSize: 12, color: theme.inkSoft }}>#{item.informativo}</span>
              )}
              <span style={{ marginLeft: 'auto' }}>
                <EstrelasBadge value={item.estrelas} size={15} showLabel />
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: theme.warnDeep }}>
                ↑ {INCIDENCIA_LABEL[item.incidencia_concursos]}
              </span>
            </div>
            <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: theme.ink, letterSpacing: -0.4, margin: '0 0 4px', lineHeight: 1.4 }}>
              {item.titulo || `${item.disciplina}${item.materia ? ` · ${item.materia}` : ''}`}
            </h1>
            <p style={{ fontSize: 14, color: theme.inkSoft, margin: 0 }}>
              {item.titulo ? `${item.disciplina}${item.materia ? ` · ${item.materia}` : ''}` : ''}
              {item.titulo && item.assunto ? ' · ' : ''}
              {item.assunto ?? ''}
            </p>
          </div>
        )}

        {/* Tabs (só quando não está editando) */}
        {!editing && (
          <div style={{ display: 'flex', gap: 2, marginBottom: 16, background: 'rgba(15,23,42,.04)', borderRadius: 10, padding: 3, width: 'fit-content' }}>
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontFamily: theme.font, fontSize: 13, fontWeight: 600,
                  background: tab === key ? theme.card : 'transparent',
                  color: tab === key ? theme.ink : theme.inkSoft,
                  boxShadow: tab === key ? theme.shadow : 'none',
                  transition: 'all .15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Conteúdo */}
        {editing ? (
          <div style={{ background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: isMobile ? 16 : 28 }}>
            <JurisprudenciaForm
              initial={{
                tribunal: item.tribunal,
                orgao_julgador: item.orgao_julgador ?? undefined,
                tipo: item.tipo,
                informativo: item.informativo ?? undefined,
                processo: item.processo ?? undefined,
                relator: item.relator ?? undefined,
                data_julgamento: item.data_julgamento ?? undefined,
                data_publicacao: item.data_publicacao ?? undefined,
                status: item.status,
                disciplina: item.disciplina,
                materia: item.materia ?? undefined,
                assunto: item.assunto ?? undefined,
                subassunto: item.subassunto ?? undefined,
                dispositivos_relacionados: item.dispositivos_relacionados ?? undefined,
                tese: item.tese,
                resumo: item.resumo ?? undefined,
                explicacao_comparativa: item.explicacao_comparativa ?? undefined,
                por_que_aplica: item.por_que_aplica ?? undefined,
                esquema_visual: item.esquema_visual ?? undefined,
                exemplo_pratico: item.exemplo_pratico ?? undefined,
                pegadinhas: item.pegadinhas ?? undefined,
                tese_banca: item.tese_banca ?? undefined,
                como_banca_cobra: item.como_banca_cobra ?? undefined,
                palavras_chave: item.palavras_chave,
                estrelas: item.estrelas,
                incidencia_concursos: item.incidencia_concursos,
                supera_entendimento_anterior: item.supera_entendimento_anterior,
                observacao_evolucao: item.observacao_evolucao ?? undefined,
              }}
              saving={saving}
              onSave={handleSave}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : tab === 'leitura' ? (
          <div style={{ background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: isMobile ? 16 : 28 }}>
            <JurisprudenciaDetail item={item} isMobile={isMobile} />
          </div>
        ) : tab === 'estudo' ? (
          <JurisModoEstudo item={item} />
        ) : (
          <JurisInteracoesPanel jurisId={id} />
        )}

        {/* Metadados rodapé */}
        {!editing && (
          <p style={{ fontSize: 12, color: theme.inkFaint, margin: '16px 0 0', textAlign: 'right' }}>
            Criado em {new Date(item.created_at).toLocaleDateString('pt-BR')}
            {item.updated_at !== item.created_at && ` · Atualizado em ${new Date(item.updated_at).toLocaleDateString('pt-BR')}`}
          </p>
        )}
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  actionBtn: {
    padding: '8px 16px', borderRadius: theme.radiusSm,
    border: `0.5px solid ${theme.line}`, background: theme.card,
    color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
  },
  actionBtnDanger: {
    padding: '8px 16px', borderRadius: theme.radiusSm,
    border: `1px solid ${theme.danger}`, background: theme.dangerBg,
    color: theme.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
};
