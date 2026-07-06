'use client';

import { type CatalogSubject, type CatalogTopic } from '@/services/catalog.service';
import { theme } from '@/lib/theme';

interface Props {
  subject: CatalogSubject;
  topics: CatalogTopic[];
  loading: boolean;
  activating: boolean;
  onActivate: () => void;
  onClose: () => void;
}

export function SubjectTopicsModal({ subject, topics, loading, activating, onActivate, onClose }: Props) {
  const parents = topics.filter((t) => t.parent_id === null);
  const childrenMap = topics.reduce<Record<string, CatalogTopic[]>>((acc, t) => {
    if (t.parent_id) (acc[t.parent_id] ??= []).push(t);
    return acc;
  }, {});
  const parentIdSet = new Set(parents.map((p) => p.id));
  const orphans = topics.filter((t) => t.parent_id !== null && !parentIdSet.has(t.parent_id));

  return (
    <>
      {/* Backdrop */}
      <div
        className="backdrop-enter"
        onClick={() => { if (!activating) onClose(); }}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)',
          zIndex: 60, backdropFilter: 'blur(3px)',
          cursor: activating ? 'not-allowed' : 'default',
        }}
      />

      {/* Painel */}
      <div className="modal-enter" style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(600px, 92vw)', maxHeight: 'min(82vh, calc(100dvh - 80px))',
        background: theme.card, borderRadius: 20,
        boxShadow: theme.shadowModal,
        display: 'flex', flexDirection: 'column',
        zIndex: 70, overflow: 'hidden',
      }}>
        {/* Cabeçalho */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: `0.5px solid ${theme.line}`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: theme.ink, letterSpacing: -0.4 }}>
              {subject.name}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: theme.inkSoft }}>
              {subject.parent_count} tópicos · {subject.topic_count - subject.parent_count} subtópicos
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: theme.inkFaint, padding: 6, flexShrink: 0, borderRadius: 8, display: 'grid', placeItems: 'center' }}
            aria-label="Fechar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Lista de tópicos (rolável) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loading ? (
            <p style={{ color: theme.inkFaint, fontSize: 14 }}>Carregando tópicos…</p>
          ) : topics.length === 0 ? (
            <p style={{ color: theme.inkFaint, fontSize: 14 }}>Nenhum tópico cadastrado.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {parents.map((parent) => {
                const children = childrenMap[parent.id] ?? [];
                return (
                  <div key={parent.id} style={{ marginBottom: children.length ? 10 : 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: theme.ink,
                      padding: '6px 10px', borderRadius: 8,
                      background: 'rgba(15,23,42,.05)',
                    }}>
                      {parent.name}
                    </div>
                    {children.length > 0 && (
                      <div style={{
                        marginLeft: 16, marginTop: 4,
                        borderLeft: `2px solid ${theme.line}`,
                        paddingLeft: 12,
                        display: 'flex', flexDirection: 'column', gap: 1,
                      }}>
                        {children.map((child) => (
                          <div key={child.id} style={{ fontSize: 13, color: theme.inkSoft, padding: '4px 0' }}>
                            {child.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {orphans.map((t) => (
                <div key={t.id} style={{ fontSize: 13, color: theme.inkSoft, padding: '4px 0' }}>
                  {t.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé com ação */}
        {!loading && (
          <div style={{
            padding: '14px 24px',
            borderTop: `0.5px solid ${theme.line}`,
            display: 'flex', justifyContent: 'flex-end', gap: 10,
          }}>
            <button onClick={onClose} style={{
              padding: '10px 18px', borderRadius: 10, border: `0.5px solid ${theme.line}`,
              background: 'transparent', color: theme.inkSoft, fontSize: 14, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Fechar
            </button>
            {subject.is_activated ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 18px', borderRadius: 10,
                background: theme.okBg, color: theme.ok, fontSize: 14, fontWeight: 600,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                Matéria ativa
              </span>
            ) : (
              <button
                onClick={onActivate}
                disabled={activating}
                style={{
                  padding: '10px 20px', borderRadius: 10, border: 'none',
                  background: theme.teal, color: theme.onTeal,
                  fontSize: 14, fontWeight: 600, cursor: activating ? 'wait' : 'pointer',
                  fontFamily: 'inherit', opacity: activating ? 0.7 : 1,
                }}
              >
                {activating ? 'Ativando…' : '+ Ativar matéria'}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
