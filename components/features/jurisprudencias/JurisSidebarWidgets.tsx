'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Star, TrendingUp, Clock } from 'lucide-react';
import { theme } from '@/lib/theme';
import { listUltimasAdicionadas, listMaisCobradas, type Jurisprudencia } from '@/services/jurisprudencias.service';
import { listFavoritas, listRevisoesHoje, type JurisComInteracao } from '@/services/jurisInteracoes.service';
import { Skeleton } from '@/components/ui/Skeleton';

function RowSkeleton() {
  return (
    <div style={{ padding: '7px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Skeleton width="80%" height={13} />
      <Skeleton width="40%" height={11} />
    </div>
  );
}

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
  const [erros, setErros] = useState({ revisoes: false, favoritas: false, maisCobradas: false, ultimas: false });

  useEffect(() => {
    listRevisoesHoje().then(setRevisoes).catch(() => { setRevisoes([]); setErros((e) => ({ ...e, revisoes: true })); });
    listFavoritas().then(setFavoritas).catch(() => { setFavoritas([]); setErros((e) => ({ ...e, favoritas: true })); });
    listMaisCobradas(5).then(setMaisCobradas).catch(() => { setMaisCobradas([]); setErros((e) => ({ ...e, maisCobradas: true })); });
    listUltimasAdicionadas(5).then(setUltimas).catch(() => { setUltimas([]); setErros((e) => ({ ...e, ultimas: true })); });
  }, []);

  function go(id: string) { router.push(`/jurisprudencias/${id}`); }

  return (
    <div style={styles.wrap}>
      <WidgetBox
        title="Revisões de hoje"
        icon={<RefreshCw size={13} strokeWidth={1.7} />}
        action={revisoes && revisoes.length > 0 ? { label: 'Revisar', onClick: () => router.push('/jurisprudencias/revisar') } : undefined}
      >
        {revisoes === null ? (
          <><RowSkeleton /><RowSkeleton /></>
        ) : erros.revisoes ? (
          <p style={{ ...styles.muted, color: theme.danger }}>Não foi possível carregar.</p>
        ) : revisoes.length === 0 ? (
          <p style={styles.muted}>Nada para revisar hoje.</p>
        ) : (
          revisoes.slice(0, 4).map((j) => (
            <Row key={j.id} label={rotulo(j)} sub={j.tribunal} onClick={() => go(j.id)} />
          ))
        )}
      </WidgetBox>

      <WidgetBox title="Favoritas" icon={<Star size={13} fill={theme.gold} color={theme.gold} strokeWidth={1.7} />}>
        {favoritas === null ? (
          <><RowSkeleton /><RowSkeleton /></>
        ) : erros.favoritas ? (
          <p style={{ ...styles.muted, color: theme.danger }}>Não foi possível carregar.</p>
        ) : favoritas.length === 0 ? (
          <p style={styles.muted}>Nenhuma favorita ainda.</p>
        ) : (
          favoritas.slice(0, 4).map((j) => (
            <Row key={j.id} label={rotulo(j)} sub={j.tribunal} onClick={() => go(j.id)} />
          ))
        )}
      </WidgetBox>

      <WidgetBox title="Mais cobradas" icon={<TrendingUp size={13} strokeWidth={1.7} />}>
        {maisCobradas === null ? (
          <><RowSkeleton /><RowSkeleton /></>
        ) : erros.maisCobradas ? (
          <p style={{ ...styles.muted, color: theme.danger }}>Não foi possível carregar.</p>
        ) : maisCobradas.length === 0 ? (
          <p style={styles.muted}>Sem dados ainda.</p>
        ) : (
          maisCobradas.map((j) => (
            <Row key={j.id} label={rotulo(j)} sub={j.tribunal} onClick={() => go(j.id)} />
          ))
        )}
      </WidgetBox>

      <WidgetBox title="Últimas adicionadas" icon={<Clock size={13} strokeWidth={1.7} />}>
        {ultimas === null ? (
          <><RowSkeleton /><RowSkeleton /></>
        ) : erros.ultimas ? (
          <p style={{ ...styles.muted, color: theme.danger }}>Não foi possível carregar.</p>
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
  boxTitle: { fontSize: 13, fontWeight: 700, color: theme.ink, display: 'flex', alignItems: 'center', gap: 6 },
  boxAction: { fontSize: 11, fontWeight: 600, color: theme.teal, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' },
  boxBody: { padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2 },
  row: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, width: '100%', padding: '7px 8px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: theme.radiusXs, fontFamily: 'inherit', textAlign: 'left' },
  rowLabel: { fontSize: 13, color: theme.ink, lineHeight: 1.35 },
  rowSub: { fontSize: 11, color: theme.inkFaint },
  muted: { fontSize: 13, color: theme.inkFaint, padding: '8px 8px', margin: 0 },
};
