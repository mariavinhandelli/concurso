'use client';

import { FileText, Star, TriangleAlert, LayoutGrid, Lightbulb, Target, Tag } from 'lucide-react';
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
    <p style={{ fontSize: 15, color: theme.ink, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
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
  return <FileText size={16} strokeWidth={1.7} />;
}
function IconStar() {
  return <Star size={16} fill="currentColor" strokeWidth={1.7} />;
}
function IconAlert() {
  return <TriangleAlert size={16} strokeWidth={1.7} />;
}
function IconGrid() {
  return <LayoutGrid size={16} strokeWidth={1.7} />;
}
function IconLightbulb() {
  return <Lightbulb size={16} strokeWidth={1.7} />;
}
function IconTarget() {
  return <Target size={16} strokeWidth={1.7} />;
}
function IconTag() {
  return <Tag size={16} strokeWidth={1.7} />;
}

const TIPO_LABEL: Record<string, string> = {
  sumula: 'Súmula', sumula_vinculante: 'Súmula Vinculante', acordao: 'Acórdão', decisao_monocratica: 'Decisão Monocrática',
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

      {/* ── SÚMULA — texto oficial (oculto se idêntico à tese) ── */}
      {item.texto_sumula && item.texto_sumula !== item.tese && (
        <div style={{
          background: theme.card,
          border: `0.5px solid ${theme.line}`,
          borderRadius: theme.radius,
          padding: isMobile ? '16px' : '20px 24px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.inkFaint, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
            {TIPO_LABEL[item.tipo] ?? 'Súmula'}{item.numero_sumula ? ` ${item.numero_sumula}` : ''} · {item.tribunal}
          </div>
          {item.titulo && (
            <p style={{ fontSize: 14, fontWeight: 700, color: theme.ink, margin: '0 0 8px' }}>{item.titulo}</p>
          )}
          <p style={{ fontSize: 15, color: theme.ink, lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>
            “{item.texto_sumula}”
          </p>
          {(item.origem_publicacao || item.data_aprovacao) && (
            <p style={{ fontSize: 12, color: theme.inkFaint, margin: '10px 0 0' }}>
              {item.data_aprovacao ? `Aprovada em ${fmtDate(item.data_aprovacao)}` : ''}
              {item.data_aprovacao && item.origem_publicacao ? ' · ' : ''}
              {item.origem_publicacao ?? ''}
            </p>
          )}
          {(item.cancelada || item.superada || item.superada_parcialmente) && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 10,
              background: theme.dangerTint, fontSize: 13, color: theme.danger, fontWeight: 600,
            }}>
              {item.cancelada ? 'Súmula cancelada.' : item.superada ? 'Entendimento superado.' : 'Entendimento parcialmente superado.'}
              {item.superada_por && item.superada_por.length > 0 && (
                <span style={{ fontWeight: 400 }}> Ver: {item.superada_por.join(', ')}</span>
              )}
            </div>
          )}
        </div>
      )}

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
              background: item.status === 'vigente' ? theme.okTint : theme.dangerTint,
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
            fontFamily: 'monospace', fontSize: 14, color: theme.ink,
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
            background: theme.dangerTint,
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
            background: theme.warnTint,
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
              background: theme.warnTint, color: theme.warnDeep,
            }}>
              {INCIDENCIA_LABEL[item.incidencia_concursos] ?? item.incidencia_concursos}
            </span>
          </div>
        </div>
      </JurisSection>

      {/* ── JURISPRUDÊNCIAS RELACIONADAS ── */}
      <JurisSection
        title="Jurisprudências relacionadas"
        icon={<IconDoc />}
        empty={!item.jurisprudencias_relacionadas || item.jurisprudencias_relacionadas.length === 0}
      >
        {item.jurisprudencias_relacionadas && item.jurisprudencias_relacionadas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {item.jurisprudencias_relacionadas.map((rel, i) => (
              <div key={`${rel.processo}-${i}`} style={{
                display: 'flex', flexDirection: 'column', gap: 3,
                padding: '10px 14px', borderRadius: 10, background: theme.bg,
                borderLeft: `3px solid ${theme.teal}`,
              }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: theme.ink }}>{rel.processo}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: theme.tealDeep, background: theme.tealBg,
                    borderRadius: theme.radiusPill, padding: '1px 8px', textTransform: 'capitalize',
                  }}>{rel.relacao}</span>
                </div>
                <p style={{ fontSize: 13, color: theme.inkSoft, lineHeight: 1.55, margin: 0 }}>{rel.motivo}</p>
              </div>
            ))}
          </div>
        )}
      </JurisSection>

      {/* ── PALAVRAS-CHAVE ── */}
      {item.palavras_chave.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, paddingTop: 4 }}>
          {item.palavras_chave.map((k) => (
            <span key={k} style={{
              fontSize: 12, fontWeight: 500, color: theme.tealDeep,
              background: theme.tealBg, borderRadius: theme.radiusPill, padding: '4px 12px',
            }}>{k}</span>
          ))}
        </div>
      )}
    </div>
  );
}
