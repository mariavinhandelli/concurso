'use client';

import { theme } from '@/lib/theme';
import { EstrelasBadge } from './EstrelasBadge';
import { JurisSection } from './JurisSection';
import type { Jurisprudencia } from '@/services/jurisprudencias.service';

interface Props {
  item: Jurisprudencia;
  isMobile: boolean;
}

function Prose({ text }: { text: string }) {
  return (
    <p style={{ fontSize: 14.5, color: theme.ink, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
      {text}
    </p>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: theme.inkFaint, minWidth: 120, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: 14, color: theme.ink }}>{value}</span>
    </div>
  );
}

function IconDoc() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>;
}
function IconStar() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" /></svg>;
}
function IconAlert() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
}
function IconGrid() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>;
}
function IconLightbulb() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26A7 7 0 0 1 12 2Z" /></svg>;
}
function IconTarget() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
}
function IconTag() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>;
}

const TIPO_LABEL: Record<string, string> = {
  sumula: 'Súmula', acordao: 'Acórdão', decisao_monocratica: 'Decisão Monocrática',
  informativo: 'Informativo', outro: 'Outro',
};
const STATUS_LABEL: Record<string, string> = {
  vigente: 'Vigente', cancelada: 'Cancelada', substituida: 'Substituída', revisada: 'Revisada',
};
const INCIDENCIA_LABEL: Record<string, string> = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', muito_alta: 'Muito Alta',
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}

export function JurisprudenciaDetail({ item, isMobile }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: theme.font }}>

      {/* ── TESE — card de destaque ── */}
      <div style={{
        background: theme.tealBg,
        border: `1.5px solid ${theme.teal}`,
        borderRadius: theme.radius,
        padding: isMobile ? '16px' : '20px 24px',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: theme.teal, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
          Tese Principal
        </div>
        <p style={{ fontSize: isMobile ? 15 : 16, color: theme.ink, lineHeight: 1.7, margin: 0, fontWeight: 500 }}>
          {item.tese}
        </p>
      </div>

      {/* ── IDENTIFICAÇÃO ── */}
      <JurisSection title="Identificação" icon={<IconDoc />} defaultOpen={true}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <InfoRow label="Tribunal" value={item.tribunal} />
          <InfoRow label="Órgão julgador" value={item.orgao_julgador} />
          <InfoRow label="Tipo" value={TIPO_LABEL[item.tipo] ?? item.tipo} />
          <InfoRow label="Informativo" value={item.informativo} />
          <InfoRow label="Processo" value={item.processo} />
          <InfoRow label="Relator(a)" value={item.relator} />
          <InfoRow label="Data julgamento" value={fmtDate(item.data_julgamento)} />
          <InfoRow label="Data publicação" value={fmtDate(item.data_publicacao)} />
          <InfoRow label="Status" value={
            <span style={{
              fontSize: 12, fontWeight: 600, borderRadius: 6, padding: '2px 8px',
              background: item.status === 'vigente' ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.1)',
              color: item.status === 'vigente' ? theme.ok : theme.danger,
            }}>
              {STATUS_LABEL[item.status] ?? item.status}
            </span>
          } />
        </div>
      </JurisSection>

      {/* ── CLASSIFICAÇÃO ── */}
      <JurisSection title="Classificação" icon={<IconTag />} defaultOpen={true}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <InfoRow label="Disciplina" value={item.disciplina} />
          <InfoRow label="Matéria" value={item.materia} />
          <InfoRow label="Assunto" value={item.assunto} />
          <InfoRow label="Subassunto" value={item.subassunto} />
        </div>
      </JurisSection>

      {/* ── DISPOSITIVOS ── */}
      <JurisSection
        title="Dispositivos relacionados"
        icon={<IconDoc />}
        empty={!item.dispositivos_relacionados}
      >
        {item.dispositivos_relacionados && <Prose text={item.dispositivos_relacionados} />}
      </JurisSection>

      {/* ── RESUMO ── */}
      <JurisSection title="Resumo" icon={<IconDoc />} empty={!item.resumo}>
        {item.resumo && <Prose text={item.resumo} />}
      </JurisSection>

      {/* ── ENTENDA A DIFERENÇA ── */}
      <JurisSection
        title="Entenda a diferença / Explicação comparativa"
        icon={<IconLightbulb />}
        empty={!item.explicacao_comparativa}
      >
        {item.explicacao_comparativa && <Prose text={item.explicacao_comparativa} />}
      </JurisSection>

      {/* ── POR QUE SE APLICA ── */}
      <JurisSection
        title="Por que se aplica / Por que não se aplica"
        icon={<IconTarget />}
        empty={!item.por_que_aplica}
      >
        {item.por_que_aplica && <Prose text={item.por_que_aplica} />}
      </JurisSection>

      {/* ── ESQUEMA VISUAL ── */}
      <JurisSection
        title="Esquema visual em bloco"
        icon={<IconGrid />}
        empty={!item.esquema_visual}
      >
        {item.esquema_visual && (
          <div style={{
            background: theme.bg, borderRadius: 10, padding: 16,
            fontFamily: 'monospace', fontSize: 13.5, color: theme.ink,
            whiteSpace: 'pre-wrap', lineHeight: 1.7,
          }}>
            {item.esquema_visual}
          </div>
        )}
      </JurisSection>

      {/* ── EXEMPLO PRÁTICO ── */}
      <JurisSection
        title="Exemplo prático"
        icon={<IconLightbulb />}
        empty={!item.exemplo_pratico}
      >
        {item.exemplo_pratico && (
          <div style={{
            borderLeft: `3px solid ${theme.teal}`,
            paddingLeft: 14, marginLeft: 4,
          }}>
            <Prose text={item.exemplo_pratico} />
          </div>
        )}
      </JurisSection>

      {/* ── PEGADINHAS — destaque vermelho ── */}
      <JurisSection
        title="Pegadinhas de concurso"
        icon={<IconAlert />}
        highlight="danger"
        defaultOpen={!!item.pegadinhas}
        empty={!item.pegadinhas}
      >
        {item.pegadinhas && (
          <div style={{
            background: 'rgba(239,68,68,.06)',
            borderRadius: 10,
            padding: 14,
          }}>
            <Prose text={item.pegadinhas} />
          </div>
        )}
      </JurisSection>

      {/* ── EVOLUÇÃO JURISPRUDENCIAL — destaque âmbar ── */}
      <JurisSection
        title="Evolução jurisprudencial"
        icon={<IconTarget />}
        highlight="warn"
        defaultOpen={!!item.supera_entendimento_anterior}
        empty={!item.supera_entendimento_anterior || !item.observacao_evolucao}
      >
        {item.supera_entendimento_anterior && item.observacao_evolucao && (
          <div style={{
            background: 'rgba(245,158,11,.08)',
            borderRadius: 10,
            padding: 14,
          }}>
            <Prose text={item.observacao_evolucao} />
          </div>
        )}
      </JurisSection>

      {/* ── TESE DA BANCA ── */}
      <JurisSection
        title="Tese da banca"
        icon={<IconTarget />}
        highlight="warn"
        empty={!item.tese_banca}
      >
        {item.tese_banca && <Prose text={item.tese_banca} />}
      </JurisSection>

      {/* ── COMO A BANCA COBRA — destaque roxo ── */}
      <JurisSection
        title="Como a banca cobra"
        icon={<IconTarget />}
        highlight="purple"
        defaultOpen={!!item.como_banca_cobra}
        empty={!item.como_banca_cobra}
      >
        {item.como_banca_cobra && (
          <div style={{
            background: 'rgba(99,102,241,.06)',
            borderRadius: 10,
            padding: 14,
          }}>
            <Prose text={item.como_banca_cobra} />
          </div>
        )}
      </JurisSection>

      {/* ── IMPORTÂNCIA ── */}
      <JurisSection title="Importância" icon={<IconStar />} defaultOpen={true}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: theme.inkSoft, width: 120 }}>Relevância</span>
            <EstrelasBadge value={item.estrelas} showLabel />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: theme.inkSoft, width: 120 }}>Incidência</span>
            <span style={{
              fontSize: 12, fontWeight: 600, borderRadius: 6, padding: '3px 10px',
              background: 'rgba(245,158,11,.1)', color: '#b45309',
            }}>
              {INCIDENCIA_LABEL[item.incidencia_concursos] ?? item.incidencia_concursos}
            </span>
          </div>
        </div>
      </JurisSection>

      {/* ── PALAVRAS-CHAVE ── */}
      {item.palavras_chave.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, paddingTop: 4 }}>
          {item.palavras_chave.map((k) => (
            <span key={k} style={{
              fontSize: 12, fontWeight: 500, color: theme.tealDeep,
              background: theme.tealBg, borderRadius: 999, padding: '4px 12px',
            }}>{k}</span>
          ))}
        </div>
      )}
    </div>
  );
}
