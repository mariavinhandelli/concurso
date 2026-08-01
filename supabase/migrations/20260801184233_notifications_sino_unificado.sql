-- Sino como canal principal de notificação (ainda não há PWA/app nativo).
-- Antes, "lembrete diário de estudo", "seguir edital" e "leitura do mês
-- pronta" só existiam como web push do navegador — invisível pra quem nunca
-- deu permissão de notificação (a imensa maioria) e para quem fecha a aba.
-- Esta tabela dá a esses avisos um segundo canal, sempre entregue: o próprio
-- sino da topbar. O push continua existindo em paralelo, mas deixa de ser o
-- único jeito de saber.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "select own notifications" on public.notifications;
create policy "select own notifications" on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);

-- Só marcar como lida (read_at) é permitido pelo cliente; criar é só das
-- Edge Functions (service role, que ignora RLS) — não existe policy de
-- insert/delete para authenticated, então o cliente não pode gravar aqui.
drop policy if exists "mark own notifications read" on public.notifications;
create policy "mark own notifications read" on public.notifications
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
