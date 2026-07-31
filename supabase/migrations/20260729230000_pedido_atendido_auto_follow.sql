-- Fecha o ciclo do "Pedir edital": quando a curadoria marca um pedido como
-- atendido (status='atendido' + atendido_edital_id), quem pediu passa a SEGUIR
-- o edital automaticamente — e o push de novidades já existente
-- (notify-edital-updates) cuida do aviso a partir daí.
--
-- Sem isto, a promessa do modal ("você passa a acompanhar o concurso") seria
-- exatamente o tipo de promessa-sem-mecânica que a 2ª auditoria condenou.

create or replace function public.follow_on_request_atendido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'atendido'
     and new.atendido_edital_id is not null
     and (old.status is distinct from 'atendido' or old.atendido_edital_id is distinct from new.atendido_edital_id) then
    insert into public.edital_follows (user_id, edital_catalog_id)
    values (new.user_id, new.atendido_edital_id)
    on conflict (user_id, edital_catalog_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_edital_request_atendido on public.edital_requests;
create trigger trg_edital_request_atendido
  after update on public.edital_requests
  for each row execute function public.follow_on_request_atendido();
