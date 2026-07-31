-- "Pedir edital" — o escape hatch que falta no banco (padrão validado no
-- mercado: o Estudei abre o catálogo com "não encontrou? solicite à equipe").
-- Nenhuma busca deve terminar em beco sem saída: a lacuna do catálogo vira
-- pedido registrado, e a fila de pedidos vira o radar que prioriza a
-- curadoria (cada linha aqui é demanda real, não palpite).

create table if not exists public.edital_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concurso text not null check (char_length(concurso) between 2 and 120),
  cargo text check (cargo is null or char_length(cargo) <= 120),
  uf text check (uf is null or uf ~ '^[A-Z]{2}$'),
  detalhes text check (detalhes is null or char_length(detalhes) <= 500),
  status text not null default 'pendente' check (status in ('pendente', 'atendido', 'descartado')),
  -- Quando a curadoria cadastrar o edital, o vínculo permite avisar quem pediu.
  atendido_edital_id uuid references public.editais_catalog(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.edital_requests is
  'Pedidos de edital dos usuários — fila de demanda que prioriza a curadoria do catálogo.';

alter table public.edital_requests enable row level security;

-- Usuário vê e cria os próprios pedidos; curadoria (service role) faz o resto.
create policy "edital_requests_insert_own" on public.edital_requests
  for insert to authenticated with check (user_id = auth.uid());
create policy "edital_requests_select_own" on public.edital_requests
  for select to authenticated using (user_id = auth.uid());

-- Régua anti-abuso barata: no máximo 10 pedidos pendentes por usuário.
create or replace function public.check_edital_request_quota()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.edital_requests
      where user_id = new.user_id and status = 'pendente') >= 10 then
    raise exception 'Você já tem 10 pedidos aguardando — assim que atendermos algum, pode pedir mais.';
  end if;
  return new;
end $$;

drop trigger if exists trg_edital_request_quota on public.edital_requests;
create trigger trg_edital_request_quota
  before insert on public.edital_requests
  for each row execute function public.check_edital_request_quota();
