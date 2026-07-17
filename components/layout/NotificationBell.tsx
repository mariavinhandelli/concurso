// components/layout/NotificationBell.tsx
// Sino de notificações: agrega lembretes (tabela `reminders`) com data <= hoje.
// Badge com contagem + dropdown no mesmo estilo do menu da conta. Sem estado "lida".
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { theme, zIndex } from '@/lib/theme';

type Reminder = {
  id: string;
  title: string;
  date: string; // 'YYYY-MM-DD'
};

// Parse de 'YYYY-MM-DD' como data LOCAL (evita deslocamento UTC).
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

// Rótulo relativo: "Hoje", "Atrasado há N dias".
function relativeLabel(dateStr: string): string {
  const today = startOfToday();
  const d = parseLocalDate(dateStr);
  const diffDays = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diffDays <= 0) return 'Hoje';
  if (diffDays === 1) return 'Atrasado há 1 dia';
  return `Atrasado há ${diffDays} dias`;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Reminder[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    // Data de hoje em 'YYYY-MM-DD' local para comparar com a coluna `date`.
    const t = startOfToday();
    const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;

    const { data } = await supabase
      .from('reminders')
      .select('id, title, date')
      .eq('user_id', auth.user.id)
      .lte('date', todayStr)
      .order('date', { ascending: false });

    setItems((data as Reminder[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  // Recarrega ao abrir, para refletir lembretes recém-criados/deletados.
  useEffect(() => {
    if (open) load();
  }, [open]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const count = items.length;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="icon-touch-target"
        onClick={() => setOpen((v) => !v)}
        style={styles.iconBtn}
        title="Notificações"
        aria-label="Notificações"
      >
        <Bell size={19} color={theme.inkSoft} strokeWidth={1.8} />
        {count > 0 && (
          <span style={styles.badge}>{count > 9 ? '9+' : count}</span>
        )}
      </button>

      {open && (
        <div className="notification-menu" style={styles.menu} role="dialog" aria-label="Lembretes">
          <div style={styles.menuHead}>
            <div style={styles.menuName}>Lembretes</div>
            <div style={styles.menuSub}>
              {count > 0 ? `${count} pendente${count > 1 ? 's' : ''}` : 'Nada pendente'}
            </div>
          </div>

          {count === 0 ? (
            <div style={styles.empty}>Você está em dia.</div>
          ) : (
            <div style={styles.list}>
              {items.map((r) => (
                <button
                  key={r.id}
                  style={styles.item}
                  onClick={() => {
                    setOpen(false);
                    router.push('/schedule?view=mes');
                  }}
                >
                  <span style={styles.dot} />
                  <span style={styles.itemBody}>
                    <span style={styles.itemTitle}>{r.title}</span>
                    <span style={styles.itemDate}>{relativeLabel(r.date)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  iconBtn: {
    position: 'relative', width: 44, height: 44, borderRadius: 10, border: 'none',
    background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer',
    transition: 'background .15s',
  },
  badge: {
    position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, padding: '0 4px',
    borderRadius: theme.radiusXs, background: theme.danger, color: theme.onDanger, fontSize: 10, fontWeight: 700,
    display: 'grid', placeItems: 'center', lineHeight: 1, fontFamily: theme.font,
  },
  menu: {
    position: 'absolute', top: 52, right: 0, width: 'min(300px, calc(100vw - 32px))', background: theme.card,
    border: `0.5px solid ${theme.line}`, borderRadius: 14, boxShadow: theme.shadowHover,
    padding: 6, zIndex: zIndex.menu, fontFamily: theme.font,
  },
  menuHead: { padding: '10px 12px 12px', borderBottom: `0.5px solid ${theme.line}`, marginBottom: 6 },
  menuName: { fontSize: 13, fontWeight: 700, color: theme.ink },
  menuSub: { fontSize: 12, color: theme.inkFaint, marginTop: 2 },
  empty: { padding: '18px 12px', fontSize: 13, color: theme.inkFaint, textAlign: 'center' },
  list: { display: 'flex', flexDirection: 'column', maxHeight: 'min(320px, calc(100vh - 200px))', overflowY: 'auto' },
  item: {
    display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', padding: '10px 12px',
    borderRadius: 9, border: 'none', background: 'transparent', cursor: 'pointer',
    textAlign: 'left', fontFamily: 'inherit',
  },
  dot: {
    width: 7, height: 7, borderRadius: '50%', background: theme.teal, marginTop: 5, flexShrink: 0,
  },
  itemBody: { display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 },
  itemTitle: {
    fontSize: 14, fontWeight: 600, color: theme.ink,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  itemDate: { fontSize: 12, color: theme.inkFaint },
};
