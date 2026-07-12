// supabase/functions/generate-lei-questoes/index.ts
// IA invisível · Fase 2 — geração cacheada global de questões C/E do Vade Mecum.
// Roda de madrugada via pg_cron, trabalha um lote pequeno do backlog por noite
// (BATCH_SIZE artigos), nunca no caminho de uma requisição de usuária.
//
// Cache global: cada artigo é processado 1x (ai_artifacts.source_key = art.key,
// deduplicado por source_hash) e serve a base inteira — custo é O(artigos), não
// O(usuárias). O backlog embutido (./data/gap-batch.json) é a lista de artigos de
// alta incidência sem nenhuma questão C/E hoje, calculada offline a partir de
// public/leis/*.json + *-questoes.json; para processar o próximo lote, recalcule
// o backlog e faça redeploy — mesmo modelo de "conteúdo raramente muda" já aceito
// para o texto das leis.
//
// Validação (regra de arquitetura — ver memória project_vademecum, tabela de
// incidência fabricada detectada e descartada em jul/2026): NADA gerado é
// publicado sem checagem independente. Um segundo modelo (juiz), que NÃO recebe
// o gabarito reivindicado, classifica a afirmação a partir do texto do artigo;
// só publica se juiz e gerador concordarem. Discordância → status 'rejected',
// nunca descartado silenciosamente (fica auditável em ai_artifacts).
//
// Consumo: services/leiQuestoes.service.ts (client) mescla os artefatos
// 'published' deste artifact_type às questões estáticas do JSON, por lei.
//
// Segredo necessário: ANTHROPIC_API_KEY (via `supabase secrets set`) — configurada
// pela Maria, nunca por este agente (política de segurança: chaves de API não são
// inseridas por IA em nenhum sistema).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import gapBatch from './data/gap-batch.json' with { type: 'json' };

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const BATCH_SIZE = 8; // artigos processados por execução (~16 chamadas de LLM)

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface GapArtigo {
  slug: string;
  key: string;
  rotulo: string;
  caminho: string;
  texto: string;
}

const QUESTAO_SCHEMA = {
  type: 'object',
  properties: {
    enunciado: { type: 'string' },
    gabarito: { type: 'boolean' },
    comentario: { type: 'string' },
    tipo: { type: 'string', enum: ['literal', 'pegadinha'] },
  },
  required: ['enunciado', 'gabarito', 'comentario', 'tipo'],
  additionalProperties: false,
};

const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    classificacao: { type: 'boolean' },
    justificativa: { type: 'string' },
  },
  required: ['classificacao', 'justificativa'],
  additionalProperties: false,
};

// lastError: diagnóstico leve para o payload de resposta (nunca gravado em
// ai_artifacts) — evita depender de log de stdout, que a ferramenta de
// inspeção do Supabase não expõe em detalhe.
let lastError: string | null = null;

async function callClaude(
  model: string,
  system: string,
  userText: string,
  schema: Record<string, unknown>,
  disableThinking: boolean,
): Promise<Record<string, unknown> | null> {
  const body: Record<string, unknown> = {
    model,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: userText }],
    output_config: { format: { type: 'json_schema', schema } },
  };
  if (disableThinking) body.thinking = { type: 'disabled' };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Claude API ${res.status}: ${text}`);
    if (!lastError) lastError = `HTTP ${res.status}: ${text.slice(0, 500)}`;
    return null;
  }
  const data = await res.json();
  if (data.stop_reason === 'refusal') {
    if (!lastError) lastError = 'refusal';
    return null;
  }
  const textBlock = (data.content ?? []).find((b: { type: string }) => b.type === 'text');
  if (!textBlock) {
    if (!lastError) lastError = `sem bloco de texto: ${JSON.stringify(data).slice(0, 500)}`;
    return null;
  }
  try {
    return JSON.parse(textBlock.text);
  } catch {
    if (!lastError) lastError = `JSON inválido: ${textBlock.text.slice(0, 500)}`;
    return null;
  }
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// targetGabarito é IMPOSTO, não sugerido: deixar o modelo escolher livremente
// faz ele quase sempre optar pelo caminho fácil (reproduzir o artigo como
// afirmação verdadeira). O lote alterna true/false para garantir a mistura
// ~50/50 que bancas reais têm — um banco só de "Certo" ensina o hábito errado.
async function generateQuestao(art: GapArtigo, targetGabarito: boolean) {
  return callClaude(
    'claude-sonnet-5',
    'Você escreve questões de Certo/Errado (estilo banca CESPE/CEBRASPE) para concursos públicos brasileiros, ' +
      'a partir estritamente do texto literal de um artigo de lei. Nunca invente fatos, prazos, números ou ' +
      'exceções que não constem no texto.',
    `Artigo ${art.rotulo} (${art.caminho}):\n\n"${art.texto}"\n\n` +
      `Escreva UMA questão de Certo/Errado sobre o conteúdo deste artigo cujo gabarito seja ${targetGabarito ? '"Certo" (gabarito=true)' : '"Errado" (gabarito=false)'}. ` +
      (targetGabarito
        ? 'Reproduza fielmente o conteúdo do artigo, com redação equivalente (não copie a frase literal palavra por palavra) mas sem alterar o sentido jurídico. tipo="literal".'
        : 'Introduza UM erro sutil e plausível em relação ao texto (trocar um prazo, um sujeito, uma condição, uma competência, um quórum) — nunca um erro absurdo ou óbvio. tipo="pegadinha".') +
      ' O comentário deve justificar o gabarito citando o próprio artigo.',
    QUESTAO_SCHEMA,
    true,
  );
}

async function judgeQuestao(art: GapArtigo, enunciado: string) {
  return callClaude(
    'claude-haiku-4-5',
    'Você avalia afirmações de concurso público (Certo/Errado) exclusivamente com base no texto de lei fornecido, ' +
      'sem qualquer informação externa sobre a intenção de quem escreveu a afirmação.',
    `Artigo ${art.rotulo}:\n\n"${art.texto}"\n\nAfirmação a avaliar:\n"${enunciado}"\n\n` +
      'Com base SOMENTE no texto do artigo acima, essa afirmação está CERTA ou ERRADA?',
    JUDGE_SCHEMA,
    false,
  );
}

Deno.serve(async () => {
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada' }), { status: 500 });
  }

  const backlog = gapBatch as GapArtigo[];
  const allKeys = backlog.map((a) => a.key);

  const { data: done } = await supabase
    .from('ai_artifacts')
    .select('source_key')
    .eq('artifact_type', 'questao_ce_lei')
    .in('source_key', allKeys);
  const doneSet = new Set((done ?? []).map((r) => r.source_key as string));

  const pending = backlog.filter((a) => !doneSet.has(a.key)).slice(0, BATCH_SIZE);

  let published = 0, rejected = 0, errored = 0;

  for (let i = 0; i < pending.length; i++) {
    const art = pending[i];
    const targetGabarito = i % 2 === 0; // alterna Certo/Errado dentro do lote
    try {
      const gerada = await generateQuestao(art, targetGabarito);
      if (!gerada || typeof gerada.enunciado !== 'string' || typeof gerada.gabarito !== 'boolean') {
        errored++;
        continue;
      }

      const julgamento = await judgeQuestao(art, gerada.enunciado as string);
      const concordam = !!julgamento && julgamento.classificacao === gerada.gabarito;

      const sourceHash = await sha256Hex(art.texto);
      const { error } = await supabase.from('ai_artifacts').insert({
        artifact_type: 'questao_ce_lei',
        source_key: art.key,
        source_hash: sourceHash,
        payload: {
          leiSlug: art.slug,
          artigoKey: art.key,
          enunciado: gerada.enunciado,
          gabarito: gerada.gabarito,
          comentario: gerada.comentario,
          tipo: gerada.tipo,
        },
        status: concordam ? 'published' : 'rejected',
        validation_notes: julgamento
          ? `juiz: ${julgamento.classificacao} — ${julgamento.justificativa}`
          : 'juiz não retornou classificação válida',
        model: 'claude-sonnet-5+claude-haiku-4-5',
        validated_at: new Date().toISOString(),
      });
      if (error && error.code !== '23505') { errored++; continue; } // 23505 = já existe (hash igual), ok
      if (concordam) published++; else rejected++;
    } catch (e) {
      console.error(`Erro processando ${art.key}:`, e);
      errored++;
    }
  }

  return new Response(
    JSON.stringify({ backlogTotal: backlog.length, jaProcessados: doneSet.size, tentados: pending.length, published, rejected, errored, lastError }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
