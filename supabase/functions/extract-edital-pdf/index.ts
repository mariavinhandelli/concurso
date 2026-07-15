// supabase/functions/extract-edital-pdf/index.ts
// IA ativa — extração de edital a partir de um PDF que a própria usuária sobe.
// Diferente das Fases 1-3 (IA invisível, pg_cron noturno, nunca no caminho de
// uma requisição), esta function é chamada DIRETO pelo cliente
// (supabase.functions.invoke) com o JWT da usuária — a primeira do projeto
// nesse formato.
//
// Por isso o client Supabase aqui NÃO usa a service role: usa a anon key +
// repassa o header Authorization de quem chamou. RLS resolve sozinho "isso é
// meu?" tanto no storage (`edital-uploads`, policies owner-only) quanto na
// tabela de log (`edital_pdf_extractions`, que por isso tem policy de INSERT
// para authenticated — diferente do padrão das Fases 1-3, onde a escrita é
// exclusiva do service role).
//
// Conteúdo é PRIVADO (o PDF é da própria usuária) — segue o padrão da Fase 3
// (grava direto, nunca em ai_artifacts, que é legível por qualquer
// autenticado). Só que aqui não há "gravação final" nenhuma: a function
// devolve o resultado estruturado pro cliente revisar/editar antes de criar
// o target_exam (ver services/editalImport.service.ts) — nada é persistido
// como concurso até a usuária confirmar.
//
// Validação: juiz (Haiku) recebe o MESMO PDF + o JSON gerado e confirma
// fidelidade (nada de matéria/tópico inventado que não esteja no PDF) — igual
// ao padrão fiel/justificativa da Fase 3.
//
// Custo: enviar o PDF inteiro duas vezes (gerador + juiz) é ordens de
// grandeza mais caro que os pipelines noturnos (que processam texto curto).
// Por isso o rate limit (RATE_LIMIT_PER_DAY) é mais apertado que qualquer
// guardrail existente no projeto.
//
// Privacidade: o PDF nunca fica retido além do necessário — é apagado do
// storage ao final desta function (sucesso, rejeição do juiz ou erro), no
// finally. Isso não cobre a function crashar antes do finally nem a usuária
// subir e nunca confirmar — o backstop é o cron cleanup-stale-edital-uploads
// (migração 20260714100000), que limpa qualquer sobra com mais de 1h.
//
// Segredo necessário: ANTHROPIC_API_KEY (mesmo secret das outras functions).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const RATE_LIMIT_PER_DAY = 5;
const MAX_TOKENS = 12000; // edital real pode ter 15-30 matérias × 5-20 tópicos — bem acima dos 1024 dos outros pipelines

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Materia {
  nome: string;
  topicos: string[];
}

interface EditalExtraido {
  orgao: string;
  cargo: string;
  banca: string;
  ano: number;
  examDate: string;
  materias: Materia[];
}

const EDITAL_SCHEMA = {
  type: 'object',
  properties: {
    orgao: { type: 'string' },
    cargo: { type: 'string' },
    banca: { type: 'string' },
    ano: { type: 'integer' },
    examDate: { type: 'string' },
    materias: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nome: { type: 'string' },
          topicos: { type: 'array', items: { type: 'string' } },
        },
        required: ['nome', 'topicos'],
        additionalProperties: false,
      },
    },
  },
  required: ['orgao', 'cargo', 'banca', 'ano', 'examDate', 'materias'],
  additionalProperties: false,
};

const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    fiel: { type: 'boolean' },
    justificativa: { type: 'string' },
  },
  required: ['fiel', 'justificativa'],
  additionalProperties: false,
};

type ContentBlock =
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
  | { type: 'text'; text: string };

let lastError: string | null = null;

// Conversão em chunks — String.fromCharCode(...bytes) de uma vez estoura o
// limite de argumentos da call stack para um PDF de alguns MB.
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function callClaude(
  model: string,
  system: string,
  content: ContentBlock[],
  schema: Record<string, unknown>,
  maxTokens: number,
): Promise<{ data: Record<string, unknown> | null; truncated: boolean }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }],
      output_config: { format: { type: 'json_schema', schema } },
      thinking: { type: 'disabled' },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Claude API ${res.status}: ${text}`);
    if (!lastError) lastError = `HTTP ${res.status}: ${text.slice(0, 500)}`;
    return { data: null, truncated: false };
  }
  const data = await res.json();
  if (data.stop_reason === 'max_tokens') {
    if (!lastError) lastError = 'resposta truncada por max_tokens — edital grande demais';
    return { data: null, truncated: true };
  }
  if (data.stop_reason === 'refusal') {
    if (!lastError) lastError = 'refusal';
    return { data: null, truncated: false };
  }
  const textBlock = (data.content ?? []).find((b: { type: string }) => b.type === 'text');
  if (!textBlock) {
    if (!lastError) lastError = `sem bloco de texto: ${JSON.stringify(data).slice(0, 500)}`;
    return { data: null, truncated: false };
  }
  try {
    return { data: JSON.parse(textBlock.text), truncated: false };
  } catch {
    if (!lastError) lastError = `JSON inválido: ${textBlock.text.slice(0, 500)}`;
    return { data: null, truncated: false };
  }
}

function documentBlock(base64Pdf: string): ContentBlock {
  return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf } };
}

async function extractEdital(base64Pdf: string) {
  return callClaude(
    'claude-sonnet-5',
    'Você extrai a estrutura de editais de concurso público brasileiro. Use SOMENTE o que está escrito no PDF — ' +
      'nunca invente órgão, cargo, banca, ano, data de prova, matéria ou tópico que não conste no documento. Quando ' +
      'um campo não estiver identificável no PDF, devolva string vazia ("") ou 0 (para ano). A lista de matérias e ' +
      'tópicos deve refletir o conteúdo programático (anexo de disciplinas) do edital, agrupando os tópicos sob a ' +
      'disciplina/matéria a que pertencem, na ordem em que aparecem no documento.',
    [
      documentBlock(base64Pdf),
      {
        type: 'text',
        text:
          'Extraia deste edital: órgão, cargo/vaga, banca organizadora, ano do concurso, data da prova objetiva ' +
          '(formato YYYY-MM-DD, string vazia se não houver data definida) e a lista completa de matérias com seus ' +
          'respectivos tópicos, a partir do conteúdo programático.',
      },
    ],
    EDITAL_SCHEMA,
    MAX_TOKENS,
  );
}

async function judgeExtraction(base64Pdf: string, extraido: EditalExtraido) {
  return callClaude(
    'claude-haiku-4-5',
    'Você verifica se uma extração estruturada de um edital reflete fielmente o PDF original, sem matéria, ' +
      'tópico ou dado inventado.',
    [
      documentBlock(base64Pdf),
      {
        type: 'text',
        text:
          `Extração gerada:\n${JSON.stringify(extraido)}\n\n` +
          'Compare com o PDF acima. fiel=true SOMENTE se todo órgão/cargo/banca/ano/data e TODAS as matérias e ' +
          'tópicos listados realmente constam no documento, sem invenção e sem omissão grave de disciplinas do ' +
          'conteúdo programático. fiel=false se qualquer matéria, tópico ou dado tiver sido inventado, ou se ' +
          'disciplinas inteiras do conteúdo programático tiverem sido omitidas.',
      },
    ],
    JUDGE_SCHEMA,
    1024,
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const jsonHeaders = { ...CORS_HEADERS, 'Content-Type': 'application/json' };

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada' }), { status: 500, headers: jsonHeaders });
  }

  let path: string;
  try {
    const body = await req.json();
    path = body.path;
    if (typeof path !== 'string' || !path) throw new Error();
  } catch {
    return new Response(JSON.stringify({ error: 'path inválido' }), { status: 400, headers: jsonHeaders });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: jsonHeaders });
  }
  const userId = userData.user.id;

  async function logAndCleanup(status: 'success' | 'rejected' | 'error', reason: string | null) {
    await supabase.from('edital_pdf_extractions').insert({ user_id: userId, status, reason });
    await supabase.storage.from('edital-uploads').remove([path]);
  }

  // Rate limit: conta tentativas da própria usuária nas últimas 24h antes de
  // gastar qualquer chamada de LLM (o custo aqui, PDF inteiro 2x, é bem maior
  // que os pipelines noturnos).
  const { count } = await supabase
    .from('edital_pdf_extractions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 86_400_000).toISOString());
  if ((count ?? 0) >= RATE_LIMIT_PER_DAY) {
    return new Response(
      JSON.stringify({ error: `Limite de ${RATE_LIMIT_PER_DAY} extrações por dia atingido. Tente de novo amanhã ou cole o texto do edital manualmente.` }),
      { status: 429, headers: jsonHeaders },
    );
  }

  try {
    const { data: blob, error: downloadError } = await supabase.storage.from('edital-uploads').download(path);
    if (downloadError || !blob) {
      await logAndCleanup('error', `download falhou: ${downloadError?.message ?? 'sem blob'}`);
      return new Response(JSON.stringify({ error: 'Não foi possível ler o PDF enviado.' }), { status: 500, headers: jsonHeaders });
    }

    const base64Pdf = arrayBufferToBase64(await blob.arrayBuffer());

    const { data: gerado, truncated } = await extractEdital(base64Pdf);
    if (truncated) {
      await logAndCleanup('error', 'truncado por max_tokens');
      return new Response(
        JSON.stringify({ error: 'Este edital tem conteúdo programático extenso demais para a extração automática. Cole o texto manualmente.' }),
        { status: 422, headers: jsonHeaders },
      );
    }
    if (!gerado || !Array.isArray(gerado.materias)) {
      await logAndCleanup('error', lastError ?? 'geração falhou');
      return new Response(JSON.stringify({ error: 'Não foi possível extrair o edital deste PDF. Tente colar o texto manualmente.' }), { status: 500, headers: jsonHeaders });
    }

    const extraido = gerado as unknown as EditalExtraido;
    const { data: julgamento } = await judgeExtraction(base64Pdf, extraido);
    const fiel = !!julgamento && julgamento.fiel === true;

    if (!fiel) {
      const motivo = julgamento ? (julgamento.justificativa as string) : 'juiz não retornou classificação válida';
      await logAndCleanup('rejected', motivo);
      return new Response(
        JSON.stringify({ error: 'A extração não pôde ser validada como fiel ao PDF. Tente colar o texto manualmente.' }),
        { status: 422, headers: jsonHeaders },
      );
    }

    await logAndCleanup('success', null);
    return new Response(JSON.stringify({ edital: extraido }), { headers: jsonHeaders });
  } catch (e) {
    console.error('Erro inesperado em extract-edital-pdf:', e);
    await logAndCleanup('error', 'exceção não tratada');
    return new Response(JSON.stringify({ error: 'Erro inesperado ao processar o PDF.' }), { status: 500, headers: jsonHeaders });
  }
});
