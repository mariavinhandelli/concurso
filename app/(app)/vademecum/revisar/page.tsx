// app/(app)/vademecum/revisar/page.tsx
// Fila de revisão espaçada de artigos: o texto aparece com os GRIFOS OCULTOS
// (lacunas) — recall ativo sem custo de criação de cartão. Clique revela cada
// lacuna; avalie com Errei/Difícil/Ok/Dominei (intervalos 1/3/15/45).
'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { PartyPopper } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  listRevisoesDue, submitRevisaoArtigo, hydrateLeiInteracoes,
  type LeiItemHidratado,
} from '@/services/leiInteracoes.service';
import { type JurisRating } from '@/lib/juris-review';
import { refreshHomeAfterSession } from '@/lib/home-refresh';
import { savePassiveSession } from '@/services/passiveSession.service';
import { useUI } from '@/components/layout/UIContext';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/Page';
import { BackLink } from '@/components/ui/BackLink';
import { LeiRevisaoCard } from '@/components/features/vademecum/LeiRevisaoCard';

export default function RevisarArtigosPage() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isMobile } = useUI();

  const [fila, setFila] = useState<LeiItemHidratado[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [reveladas, setReveladas] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [feitas, setFeitas] = useState(0);
  // Sessão passiva (mode: leitura_lei): início do player + trava de gravação
  // única. Inicializada no efeito (Date.now() no render viola pureza).
  const inicioRef = useRef(0);
  const sessaoGravadaRef = useRef(false);
  useEffect(() => { if (!inicioRef.current) inicioRef.current = Date.now(); }, []);

  const acabou = fila !== null && idx >= fila.length;
  useEffect(() => {
    if (!acabou || feitas === 0 || sessaoGravadaRef.current) return;
    sessaoGravadaRef.current = true;
    void savePassiveSession({
      mode: 'leitura_lei',
      startedAtMs: inicioRef.current,
      itemsLabel: `Revisão de lei seca: ${feitas} artigo${feitas === 1 ? '' : 's'}.`,
    }).then((gravou) => { if (gravou) refreshHomeAfterSession(queryClient); });
  }, [acabou, feitas, queryClient]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const due = await listRevisoesDue();
        const itens = await hydrateLeiInteracoes(due);
        if (!cancelled) setFila(itens);
      } catch {
        if (!cancelled) setFila([]);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const atual = fila?.[idx] ?? null;

  async function avaliar(rating: JurisRating) {
    if (!atual || saving) return;
    setSaving(true);
    try {
      const row = await submitRevisaoArtigo(atual.artigo.key, rating);
      const dias = row.interval_days;
      toast.success(`${atual.artigo.rotulo}: volta em ${dias} dia${dias === 1 ? '' : 's'}.`);
      refreshHomeAfterSession(queryClient);
      setFeitas((n) => n + 1);
      setReveladas(new Set());
      setIdx((i) => i + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar revisão.');
    } finally {
      setSaving(false);
    }
  }

  if (fila === null) {
    return <PageContainer width="narrow" style={{ padding: 40 }}><p style={{ color: theme.inkFaint }}>Montando sua fila…</p></PageContainer>;
  }

  if (!atual) {
    return (
      <PageContainer width="narrow" style={{ padding: isMobile ? '40px 16px' : '72px 40px', textAlign: 'center' }}>
        <div style={s.doneBox}>
          <PartyPopper size={40} color={theme.teal} strokeWidth={1.5} />
          <h1 style={s.doneTitle}>
            {feitas > 0 ? `${feitas} artigo${feitas === 1 ? '' : 's'} revisado${feitas === 1 ? '' : 's'}!` : 'Nenhuma revisão de lei vencida'}
          </h1>
          <p style={s.doneSub}>
            {feitas > 0
              ? 'A lei seca agradece. Os intervalos foram reagendados.'
              : 'Grife artigos no Vade Mecum e ative a revisão para construir sua fila.'}
          </p>
          <Button onClick={() => router.push('/vademecum')}>Voltar ao Vade Mecum</Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer width="narrow">
      <div style={s.topo}>
        <BackLink href="/vademecum" style={{ marginBottom: 0 }}>Vade Mecum</BackLink>
        <span style={s.progresso}>{idx + 1} de {fila.length}</span>
      </div>

      <LeiRevisaoCard
        leiNomeCurto={atual.lei.nomeCurto}
        artigo={atual.artigo}
        interacao={atual.interacao}
        reveladas={reveladas}
        onRevelar={(grifoId) => setReveladas((prev) => new Set(prev).add(grifoId))}
        onRevelarTudo={() => setReveladas(new Set((atual.interacao.grifos ?? []).map((g) => g.id)))}
        onRate={(rating) => void avaliar(rating)}
        disabled={saving}
      />
    </PageContainer>
  );
}

const s: Record<string, CSSProperties> = {
  topo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  progresso: { fontSize: 13, fontWeight: 600, color: theme.inkSoft },
  doneBox: { textAlign: 'center', padding: '60px 20px' },
  doneTitle: { fontSize: 22, fontWeight: 700, color: theme.ink, margin: '10px 0 6px' },
  doneSub: { fontSize: 14, color: theme.inkSoft, margin: '0 0 20px' },
};
