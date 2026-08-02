-- Auditoria de performance (02/08) — 5 policies que escaparam da migration
-- 20260709235000_rls_initplan (auth_rls_initplan, confirmado via advisors):
-- ainda reavaliam `auth.uid()` por LINHA em vez de 1x por query. Mesma troca
-- semanticamente idêntica de sempre: `auth.uid()` cru → `(select auth.uid())`.
alter policy edital_requests_select_own on public.edital_requests
  using (user_id = (select auth.uid()));

alter policy edital_requests_insert_own on public.edital_requests
  with check (user_id = (select auth.uid()));

alter policy friendships_update_addressee on public.friendships
  using ((select auth.uid()) = addressee_id and status = 'pending'::text)
  with check ((select auth.uid()) = addressee_id);

alter policy monthly_narratives_select_own on public.monthly_narratives
  using (user_id = (select auth.uid()));

alter policy progress_snapshots_select_own on public.progress_snapshots
  using (user_id = (select auth.uid()));
