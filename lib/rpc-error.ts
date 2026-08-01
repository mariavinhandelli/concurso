// lib/rpc-error.ts
// Traduz erro de RPC do Postgres para mensagem de usuário.
//
// POR QUE: os serviços faziam `throw new Error('Erro ao ativar edital: ' + error.message)`.
// Quando a RPC quebrava por defeito interno, o usuário lia coisas como
// "Erro ao ativar edital: function unaccent(text) does not exist" — jargão de
// banco, sem nenhuma ação possível do lado dele. Engolir o erro também não
// serve (é o H11: falha silenciosa é pior). O meio-termo correto:
//
// - `raise exception` de dentro da nossa RPC (código P0001) é mensagem ESCRITA
//   para o usuário ("Usuário não autenticado", "Edital não encontrado") →
//   mostra como está.
// - Qualquer outro código (42883 função inexistente, 23505 unique violation,
//   57014 timeout…) é defeito nosso ou indisponibilidade → mensagem humana e
//   acionável na tela, detalhe técnico no console para diagnóstico.

interface PostgrestLikeError {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

/** Código do `raise exception` do plpgsql — mensagem escrita por nós, para ler. */
const RAISE_EXCEPTION = 'P0001';

export function rpcErrorMessage(
  error: PostgrestLikeError,
  fallback: string,
  contexto: string,
): string {
  // Sempre registra o erro real: sem isto, trocar a mensagem viraria perda de
  // informação de diagnóstico.
  console.error(`[rpc] ${contexto}:`, error.code, error.message, error.details ?? '', error.hint ?? '');

  if (error.code === RAISE_EXCEPTION) return error.message;

  // Casos genéricos com ação clara para o usuário — mesmas regras que
  // social.service.ts já aplicava no seu `mensagemAmigavel` local. (Aquele
  // helper tem regras de domínio próprias — pedido duplicado, bloqueio — e por
  // isso segue lá; se um dia mais módulos precisarem, ele vira um parâmetro
  // opcional deste aqui em vez de uma terceira cópia.)
  if (/Failed to fetch|NetworkError/i.test(error.message)) {
    return 'Sem conexão com o servidor. Verifique sua internet e tente de novo.';
  }
  if (/permission denied|row-level security/i.test(error.message)) {
    return 'Você não tem permissão para isso.';
  }
  if (/statement timeout|canceling statement/i.test(error.message)) {
    return 'A operação demorou demais e foi cancelada. Nada foi salvo pela metade — tente de novo.';
  }

  return fallback;
}
