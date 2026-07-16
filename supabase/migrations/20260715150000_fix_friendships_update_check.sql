-- Corrige policy de UPDATE em friendships: sem WITH CHECK explícito, o
-- Postgres reusa a cláusula USING (que exige status='pending') também na
-- linha NOVA — mas aceitar um pedido muda status para 'accepted', então a
-- própria transição sempre violava a RLS ("new row violates row-level
-- security policy for table friendships").
drop policy if exists "friendships_update_addressee" on public.friendships;

create policy "friendships_update_addressee" on public.friendships
  for update
  using (auth.uid() = addressee_id and status = 'pending')
  with check (auth.uid() = addressee_id);
