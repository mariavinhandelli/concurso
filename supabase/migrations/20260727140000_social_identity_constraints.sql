-- P1-6 — nome de exibição e avatar eram texto livre.
-- A sanitização em services/social.service.ts é a primeira linha de defesa, mas
-- NÃO é enforcement: a tabela continua escrevível pela API REST, então quem
-- quisesse abusar bastava chamar o PostgREST direto em vez de usar a tela.
-- Estas constraints valem para INSERT e UPDATE, venham de onde vierem.
--
-- Os dois riscos, lembrando: nome de 5.000 caracteres (quebra o layout de todos
-- os amigos e colegas de turma) e avatar apontando para domínio de terceiro —
-- que, renderizado como <img src> no ranking, vira um beacon de IP/User-Agent
-- de todo mundo que abre a tela.

alter table public.social_profiles
  add constraint social_profiles_display_name_ck
  check (
    display_name is null
    or (
      char_length(display_name) <= 40
      -- controles C0/C1 e DEL
      and display_name !~ '[[:cntrl:]]'
      -- largura zero, marcas e overrides de direção: invisíveis, servem para
      -- inflar o nome ou inverter o texto ao redor dele. POSIX [[:cntrl:]] não
      -- pega estes, então comparamos com a versão sem eles.
      and display_name = translate(
            display_name,
            chr(8203) || chr(8204) || chr(8205) || chr(8206) || chr(8207) ||
            chr(8234) || chr(8235) || chr(8236) || chr(8237) || chr(8238) ||
            chr(8294) || chr(8295) || chr(8296) || chr(8297) || chr(65279),
            ''
          )
    )
  );

-- Só imagem servida pelo Storage do Supabase. Não dá para amarrar ao ref exato
-- do projeto sem cravar o ref numa migration (quebraria se o projeto mudasse),
-- então o banco garante a FORMA e o cliente (sanitizeAvatarUrl) garante que a
-- origem é exatamente a de NEXT_PUBLIC_SUPABASE_URL. Resíduo assumido: alguém
-- hospedando um beacon no próprio projeto Supabase passaria pela constraint,
-- mas não passa pelo cliente — e a CSP de img-src fecha o resto.
alter table public.social_profiles
  add constraint social_profiles_avatar_url_ck
  check (
    avatar_url is null
    or avatar_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/'
  );
