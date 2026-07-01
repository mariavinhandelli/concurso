'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { theme } from '@/lib/theme';
import { listUltimasAdicionadas, listMaisCobradas, type Jurisprudencia } from '@/services/jurisprudencias.service';
import { listFavoritas, listRevisoesHoje, type JurisComInteracao } from '@/services/jurisInteracoes.service';

function WidgetBox({ title, icon, children, action }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; action?: { label: string; onClick: () => void };
}) {
  return (
    <div style={styles.box}>
      <div style={styles.boxHead}>
        <span style={styles.boxTitle}>{icon}{title}</span>
        {action && <button onClick={action.onClick} style={styles.boxAction}>{action.label}</button>}
      </div>
      <div style={styles.boxBody}>{children}</div>
    </div>
  );
}

function Row({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      {sub && <span style={styles.rowSub}>{sub}</span>}
    </button>
  );
}

function rotulo(j: Jurisprudencia): string {
  return j.tese.length > 60 ? j.tese.slice(0, 60) + '…' : j.tese;
}

export function JurisSidebarWidgets() {
  const router = useRouter();
  const [revisoes, setRevisoes] = useState<JurisComInteracao[] | null>(null);
  const [favoritas, setFavoritas] = useState<JurisComInteracao[] | null>(null);
  const [maisCobradas, setMaisCobradas] = useState<Jurisprudencia[] | null>(null);
  const [ultimas, setUltimas] = useState<Jurisprudencia[] | null>(null);

  useEffect(() => {
    listRevisoesHoje().then(setRevisoes).catch(() => setRevisoes([]));
    listFavoritas().then(setFavoritas).catch(() => setFavoritas([]));
    listMaisCobradas(5).then(setMaisCobradas).catch(() => setMaisCobradas([]));
    listUltimasAdicionadas(5).then(setUltimas).catch(() => setUltimas([]));
  }, []);

  function go(id: string) { router.push(`/jurisprudencias/${id}`); }

  return (
    <div style={styles.wrap}>
      <WidgetBox
        title="Revisões de hoje"
        icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12a8 8 0 0113-6.2L20 8M20 4v4h-4M20 12a8 8 0 01-13 6.2L4 16M4 20v-4h4" /></svg>}
        action={revisoes && revisoes.length > 0 ? { label: 'Revisar', onClick: () => router.push('/jurisprudencias/revisar') } : undefined}
      >
        {revisoes === null ? (
          <p style={styles.muted}>Carregando…</p>
        ) : revisoes.length === 0 ? (
          <p style={styles.muted}>Nada para revisar hoje.</p>
        ) : (
          revisoes.slice(0, 4).map((j) => (
            <Row key={j.id} label={rotulo(j)} sub={j.tribunal} onClick={() => go(j.id)} />
          ))
        )}
      </WidgetBox>

      <WidgetBox title="Favoritas" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.7"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" /></svg>}>
        {favoritas === null ? (
          <p style={styles.muted}>Carregando…</p>
        ) : favoritas.length === 0 ? (
          <p style={styles.muted}>Nenhuma favorita ainda.</p>
        ) : (
          favoritas.slice(0, 4).map((j) => (
            <Row key={j.id} label={rotulo(j)} sub={j.tribunal} onClick={() => go(j.id)} />
          ))
        )}
      </WidgetBox>

      <WidgetBox title="Mais cobradas" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}>
        {maisCobradas === null ? (
          <p style={styles.muted}>Carregando…</p>
        ) : maisCobradas.length === 0 ? (
          <p style={styles.muted}>Sem dados ainda.</p>
        ) : (
          maisCobradas.map((j) => (
            <Row key={j.id} label={rotulo(j)} sub={j.tribunal} onClick={() => go(j.id)} />
          ))
        )}
      </WidgetBox>

      <WidgetBox title="Últimas adicionadas" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}>
        {ultimas === null ? (
          <p style={styles.muted}>Carregando…</p>
        ) : ultimas.length === 0 ? (
          <p style={styles.muted}>Nenhuma jurisprudência ainda.</p>
        ) : (
          ultimas.map((j) => (
            <Row key={j.id} label={rotulo(j)} sub={j.tribunal} onClick={() => go(j.id)} />
          ))
        )}
      </WidgetBox>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 12 },
  box: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, overflow: 'hidden', fontFamily: theme.font },
  boxHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: `0.5px solid ${theme.line}` },
  boxTitle: { fontSize: 12.5, fontWeight: 700, color: theme.ink, display: 'flex', alignItems: 'center', gap: 6 },
  boxAction: { fontSize: 11, fontWeight: 600, color: theme.teal, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' },
  boxBody: { padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2 },
  row: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, width: '100%', padding: '7px 8px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 8, fontFamily: 'inherit', textAlign: 'left' },
  rowLabel: { fontSize: 12.5, color: theme.ink, lineHeight: 1.35 },
  rowSub: { fontSize: 10.5, color: theme.inkFaint },
  muted: { fontSize: 12.5, color: theme.inkFaint, padding: '8px 8px', margin: 0 },
};
