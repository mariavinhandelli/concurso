-- Conquistas persistidas: o cálculo continua derivado de study_logs, mas o
-- DESBLOQUEIO vira um fato com data. Sem isso não há "conquistada em 14/07",
-- nem celebração no instante, nem estabilidade quando as metas mudam.
create table public.user_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

alter table public.user_badges enable row level security;

create policy "user_badges_select_own" on public.user_badges
  for select using ((select auth.uid()) = user_id);

create policy "user_badges_insert_own" on public.user_badges
  for insert with check ((select auth.uid()) = user_id);

-- Sem UPDATE/DELETE: conquista desbloqueada é um fato histórico, não regride.
