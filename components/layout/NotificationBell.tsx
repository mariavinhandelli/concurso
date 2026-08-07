// components/layout/NotificationBell.tsx
// Sino de notificações: agrega lembretes manuais (tabela `reminders`) com
// data <= hoje, pedidos de amizade esperando resposta, e avisos do sistema
// (tabela `notifications` — lembrete diário de estudo, novidade de edital
// seguido, leitura do mês pronta). O sino é o CANAL PRINCIPAL de notificação
// da plataforma (não há PWA/app nativo ainda, então o web push do navegador é
// só um canal secundário best-effort — ver supabase/functions/send-daily-reminders
// e notify-edital-updates). Antes só lia `reminders`, então um pedido de
// amizade não avisava em lugar nenhum — a pessoa só descobria se entrasse em
// /amigos por conta própria (auditoria de Amigos, P2-8).
// Badge com contagem + dropdown no mesmo estilo do menu da conta. Avisos do
// sistema são marcados como lidos automaticamente ao abrir o dropdown, e
// também têm ação explícita: botão de check por item + "marcar tudo como
// lido" no cabeçalho (pedido direto, já que o automático é invisível).
// Lembretes manuais só somem quando apagados na Agenda.
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';
import { getPendingRequestCount } from '@/services/social.service';
import { COMMAND_PALETTE_OPENED_EVENT } from '@/components/features/command/CommandPalette';
import { theme, zIndex } from '@/lib/theme';

type Reminder = {
  id: string;
  title: string;
  date: string; // 'YYYY-MM-DD'
};

type Notice = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string; // timestamptz ISO
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

// Rótulo relativo p/ avisos do sistema: "Hoje", "Ontem", "Há N dias".
function sinceLabel(iso: string): string {
  const today = startOfToday();
  const d = new Date(iso);
  const dLocal = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - dLocal.getTime()) / 86400000);
  if (diffDays <= 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  return `Há ${diffDays} dias`;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Reminder[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticesCount, setNoticesCount] = useState(0);
  const [pedidos, setPedidos] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // markSeen: marca os avisos do sistema recém-carregados como lidos (some do
  // sino da próxima vez). Só faz sentido quando o dropdown está de fato sendo
  // aberto — no load do mount, é só pra montar o badge.
  async function load(markSeen = false) {
    const supabase = createClient();
    const user = await getCachedUser();
    if (!user) return;

    // Data de hoje em 'YYYY-MM-DD' local para comparar com a coluna `date`.
    const t = startOfToday();
    const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;

    const [{ data: reminders }, { data: sysNotices }, { count: sysCount }, pendentes] = await Promise.all([
      supabase
        .from('reminders')
        .select('id, title, date')
        .eq('user_id', user.id)
        .lte('date', todayStr)
        .order('date', { ascending: false }),
      supabase
        .from('notifications')
        .select('id, title, body, link, created_at')
        .eq('user_id', user.id)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(20),
      // Contagem exata separada da lista (capada em 20): sem isto, o badge
      // subestimaria sempre que houvesse mais de 20 avisos não lidos.
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null),
      getPendingRequestCount(),
    ]);

    setItems((reminders as Reminder[]) ?? []);
    setNotices((sysNotices as Notice[]) ?? []);
    setNoticesCount(sysCount ?? 0);
    setPedidos(pendentes);

    if (markSeen && sysNotices?.length) {
      const ids = sysNotices.map((n) => n.id);
      // Fire-and-forget: não trava a UI, some do sino só na próxima carga.
      // O builder do supabase-js só dispara o fetch de fato dentro do seu
      // .then() (é "thenable" preguiçoso) — sem chamar .then()/await aqui,
      // a requisição nunca sai, e read_at nunca é gravado (bug real, achado
      // ao investigar o sino "nunca soma como lido").
      void supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .in('id', ids)
        .then(({ error }) => {
          if (error) console.error('Erro ao marcar avisos como lidos:', error.message);
        });
    }
  }

  // Marca um único aviso como lido — ação explícita (botão), independente do
  // marcar-automático ao abrir. Otimista: some da lista na hora; se o servidor
  // recusar, `load()` traz o estado real de volta.
  async function markOneRead(id: string) {
    setNotices((prev) => prev.filter((n) => n.id !== id));
    setNoticesCount((prev) => Math.max(0, prev - 1));
    const supabase = createClient();
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      console.error('Erro ao marcar aviso como lido:', error.message);
      load();
    }
  }

  // Marca TODOS os avisos do sistema como lidos de uma vez (não só os 20
  // carregados) — filtra por read_at is null direto no servidor.
  async function markAllRead() {
    setNotices([]);
    setNoticesCount(0);
    const supabase = createClient();
    const user = await getCachedUser();
    if (!user) return;
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);
    if (error) {
      console.error('Erro ao marcar tudo como lido:', error.message);
      load();
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Recarrega ao abrir (lembretes recém-criados/deletados) e marca os avisos
  // do sistema mostrados agora como lidos.
  useEffect(() => {
    if (open) load(true);
  }, [open]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Ctrl+K abre a paleta sem passar por nenhum mousedown — o listener acima
  // não pega esse caminho, e o dropdown do sino ficava aberto por baixo dela.
  useEffect(() => {
    function onPaletteOpened() { setOpen(false); }
    window.addEventListener(COMMAND_PALETTE_OPENED_EVENT, onPaletteOpened);
    return () => window.removeEventListener(COMMAND_PALETTE_OPENED_EVENT, onPaletteOpened);
  }, []);

  const count = items.length + noticesCount + pedidos;

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
        <div className="notification-menu floating-root" style={styles.menu} role="dialog" aria-label="Notificações">
          <div style={styles.menuHead}>
            <div>
              <div style={styles.menuName}>Notificações</div>
              <div style={styles.menuSub}>
                {count > 0 ? `${count} pendente${count > 1 ? 's' : ''}` : 'Nada pendente'}
              </div>
            </div>
            {noticesCount > 0 && (
              <button style={styles.markAllBtn} onClick={markAllRead}>
                <CheckCheck size={13} />
                Marcar tudo como lido
              </button>
            )}
          </div>

          {count === 0 ? (
            <div style={styles.empty}>Você está em dia.</div>
          ) : (
            <div style={styles.list}>
              {pedidos > 0 && (
                <button
                  style={styles.item}
                  onClick={() => { setOpen(false); router.push('/amigos'); }}
                >
                  <span style={styles.dot} />
                  <span style={styles.itemBody}>
                    <span style={styles.itemTitle}>
                      {pedidos === 1 ? '1 pedido de amizade' : `${pedidos} pedidos de amizade`}
                    </span>
                    <span style={styles.itemDate}>Esperando sua resposta</span>
                  </span>
                </button>
              )}
              {notices.map((n) => (
                <div key={n.id} style={styles.itemRow}>
                  <button
                    style={{ ...styles.item, width: 'auto', flex: 1, minWidth: 0 }}
                    onClick={() => {
                      setOpen(false);
                      router.push(n.link || '/');
                    }}
                  >
                    <span style={styles.dot} />
                    <span style={styles.itemBody}>
                      <span style={styles.itemTitle}>{n.title}</span>
                      <span style={styles.itemDate}>
                        {n.body ? `${n.body} · ${sinceLabel(n.created_at)}` : sinceLabel(n.created_at)}
                      </span>
                    </span>
                  </button>
                  <button
                    style={styles.markReadBtn}
                    title="Marcar como lido"
                    aria-label="Marcar como lido"
                    onClick={(e) => { e.stopPropagation(); markOneRead(n.id); }}
                  >
                    <Check size={14} />
                  </button>
                </div>
              ))}
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
  menuHead: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
    padding: '10px 12px 12px', borderBottom: `0.5px solid ${theme.line}`, marginBottom: 6,
  },
  menuName: { fontSize: 13, fontWeight: 700, color: theme.ink },
  menuSub: { fontSize: 12, color: theme.inkFaint, marginTop: 2 },
  markAllBtn: {
    display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginTop: 1,
    padding: '4px 6px', borderRadius: theme.radiusXs, border: 'none', background: 'transparent',
    color: theme.teal, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  },
  empty: { padding: '18px 12px', fontSize: 13, color: theme.inkFaint, textAlign: 'center' },
  list: { display: 'flex', flexDirection: 'column', maxHeight: 'min(320px, calc(100vh - 200px))', overflowY: 'auto' },
  item: {
    display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', padding: '10px 12px',
    borderRadius: 9, border: 'none', background: 'transparent', cursor: 'pointer',
    textAlign: 'left', fontFamily: 'inherit',
  },
  itemRow: { display: 'flex', alignItems: 'center', gap: 2 },
  markReadBtn: {
    flexShrink: 0, width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent',
    color: theme.inkFaint, display: 'grid', placeItems: 'center', cursor: 'pointer', marginRight: 4,
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
