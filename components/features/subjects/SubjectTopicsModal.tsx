'use client';

import { useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { type CatalogSubject, type CatalogTopic } from '@/services/catalog.service';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !activating) onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, activating]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="backdrop-enter"
        onClick={() => { if (!activating) onClose(); }}
        style={{
          position: 'fixed', inset: 0, background: 'var(--backdrop)',
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
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: theme.inkFaint, padding: 6, flexShrink: 0, borderRadius: theme.radiusXs, display: 'grid', placeItems: 'center' }}
            aria-label="Fechar"
          >
            <X size={16} strokeWidth={2} />
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
                      padding: '6px 10px', borderRadius: theme.radiusXs,
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
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            {subject.is_activated ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 18px', borderRadius: 10,
                background: theme.okBg, color: theme.ok, fontSize: 14, fontWeight: 600,
              }}>
                <Check size={14} strokeWidth={2.5} />
                Matéria ativa
              </span>
            ) : (
              <Button onClick={onActivate} disabled={activating} style={{ cursor: activating ? 'wait' : 'pointer' }}>
                {activating ? 'Ativando…' : '+ Ativar matéria'}
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
