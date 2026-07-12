'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createJurisprudencia, type JurisprudenciaInput } from '@/services/jurisprudencias.service';
import { JurisprudenciaForm } from '@/components/features/jurisprudencias/JurisprudenciaForm';
import { useToast } from '@/components/ui/ToastProvider';
import { useUI } from '@/components/layout/UIContext';
import { theme } from '@/lib/theme';
import { PageContainer, PageHeader } from '@/components/ui/Page';

export default function NovaJurisprudenciaPage() {
  const router = useRouter();
  const { isMobile } = useUI();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  async function handleSave(data: JurisprudenciaInput) {
    setSaving(true);
    try {
      const novo = await createJurisprudencia(data);
      toast.success('Jurisprudência cadastrada!');
      router.push(`/jurisprudencias/${novo.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer style={{ minWidth: 0 }}>
      <button
        className="touch-target"
        onClick={() => router.push('/jurisprudencias')}
        style={{ border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0, marginBottom: 20, fontFamily: 'inherit' }}
      >
        ← Jurisprudências
      </button>

      <PageHeader title="Nova jurisprudência" subtitle="Preencha os campos obrigatórios (Tribunal, Disciplina e Tese). Os demais podem ser preenchidos depois." />

      <div style={{ background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: isMobile ? 20 : 32 }}>
        <JurisprudenciaForm
          saving={saving}
          onSave={handleSave}
          onCancel={() => router.push('/jurisprudencias')}
        />
      </div>
    </PageContainer>
  );
}
