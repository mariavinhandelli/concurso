-- N1 (web push): assinaturas de push por usuário. Aditiva e isolada por dono (RLS).
-- Cada navegador/dispositivo gera um endpoint único; re-assinar faz upsert por endpoint.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Cada usuário só enxerga/gerencia as próprias assinaturas. O envio é feito pela
-- Edge Function com a service role (que ignora RLS).
create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete using (auth.uid() = user_id);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);
