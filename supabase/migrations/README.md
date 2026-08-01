# Migrations — estado do repositório × banco

## O problema (descoberto em 01/08/2026)

Boa parte das migrations deste projeto foi aplicada **direto no banco** (via MCP
`apply_migration`) e nunca virou arquivo aqui. O placar era:

| | quantidade |
|---|---|
| migrations registradas no banco (`supabase_migrations.schema_migrations`) | 126 |
| arquivos `.sql` neste diretório | 70 |

**Consequência real, não teórica:** o bug que quebrou a ativação de edital da
PM-GO (`function unaccent(text) does not exist`) era **invisível a qualquer busca
no repositório** — `grep -r unaccent supabase/migrations/` retornava zero, porque
as duas migrations que o causaram (`activate_catalog_subject_adopt_by_name` e
`move_unaccent_out_of_public`, ambas de 29/07) só existiam no banco. Uma
auditoria feita por leitura de código não tinha como enxergar.

## Situação atual (02/08/2026): reconciliado

**Os 64 arquivos ausentes foram reconstruídos** a partir de
`schema_migrations.statements` — o SQL exatamente como foi aplicado, com o número
de versão original registrado no ledger. Toda migration do banco tem arquivo:

```bash
# deve sair vazio
comm -23 \
  <(psql -Atc "select name from supabase_migrations.schema_migrations order by 1") \
  <(ls supabase/migrations/*.sql | sed 's/.*\///; s/\.sql$//; s/^[0-9]\{14\}_//' | sort)
```

### Arquivos que existem aqui e não no ledger (6)

Aplicados fora do `apply_migration` (editor SQL do painel, provavelmente), ou
sob outro nome. Todos com conteúdo real e não duplicado — **não remova**:

- `add_study_data_constraints` — CHECKs `not valid` em study_logs/topics/flashcards/blocks
- `add_study_session_idempotency` — colunas + uniques de `client_session_id`
- `juris_soft_delete` — `deleted_at` + índice parcial de ativos
- `merge_profile_settings` e `undo_cycle_completion_fn` — as duas funções que, no
  ledger, vieram juntas em `create_missing_rpcs_merge_settings_and_undo_cycle`
  (`create or replace`, idempotente — a duplicata é inofensiva)
- `topics_subject_position_index_and_backfill` — variante de
  `topics_subject_position_index_and_position_backfill` (índice com
  `if not exists`; o backfill é idempotente)

### Apelidos: nome no ledger ≠ nome do arquivo (2)

Estes dois eu tentei reconstruir e o conteúdo saiu **byte a byte idêntico** ao
arquivo que já existia — a cópia foi descartada para o diretório não ter duas
migrations criando a mesma tabela (o replay do zero quebraria). O arquivo vale;
só o nome difere:

| nome no ledger | arquivo aqui |
|---|---|
| `ai_artifacts_cache` | `20260712150000_ai_artifacts.sql` |
| `user_features_feature_store` | `20260712130000_user_features.sql` |

## Regra ao auditar o banco

Não confie só nos arquivos. A verdade está em:

```sql
-- o que realmente foi aplicado
select version, name from supabase_migrations.schema_migrations order by version;

-- o corpo REAL de uma função hoje
select pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'nome_da_funcao';
```

## Daqui pra frente

Toda mudança de schema deve **nascer como arquivo aqui** e só depois ser
aplicada. Se aplicar via MCP, escreva o arquivo na mesma sessão, com a mesma
versão registrada em `schema_migrations`.

## Armadilhas já pagas neste banco

1. **`revoke execute ... from anon` não protege nada.** Toda função nasce com
   EXECUTE para `PUBLIC`; anon herda por PUBLIC. O que vale é
   `revoke execute on function ... from public`, e só então
   `grant ... to authenticated`. Ver `20260801120000_revoke_public_execute_security_definer.sql`.

2. **Mover extensão de schema quebra função com `search_path` fixo.** Dentro de
   função com `set search_path`, **sempre qualifique o schema**
   (`public.immutable_unaccent`, `extensions.unaccent`). Ver
   `20260802090000_fix_activate_catalog_subject_unaccent.sql`.
   ⚠️ `pg_net` ainda está em `public` — se um dia for movido, varra antes todas as
   funções que o chamam sem qualificar.
