// services/leiQuestoes.service.ts
// Banco de questões C/E (Certo/Errado) por artigo de lei — conteúdo estático
// em public/leis/<slug>-questoes.json, mesmo padrão de leis.service.ts.
// Histórico de simulados persiste em lei_simulado_sessions (Pattern A),
// mesmo desenho de juris_simulado_sessions.
'use client';

import { requireUser, tryGetUser } from '@/lib/supabase/requireUser';

export type LeiQuestaoTipo = 'literal' | 'pegadinha';

export interface LeiQuestao {
  id: string;
  artigoKey: string; // "cf-88:37"
  enunciado: string;
  gabarito: boolean; // true = Certo, false = Errado
  comentario: string;
  tipo?: LeiQuestaoTipo; // ausente nas questões antigas da CF/88
}

// slug → arquivo de questões (nem toda lei precisa ter um).
const QUESTOES_ARQUIVO: Record<string, string> = {
  'cf-88': '/leis/cf-88-questoes.json',
  'lei-14133': '/leis/lei-14133-questoes.json',
  'lei-8429': '/leis/lei-8429-questoes.json',
  'lei-12527': '/leis/lei-12527-questoes.json',
  'lgpd': '/leis/lgpd-questoes.json',
  'lei-9784': '/leis/lei-9784-questoes.json',
  'go-13800': '/leis/go-13800-questoes.json',
  'cp': '/leis/cp-questoes.json',
  'cpp': '/leis/cpp-questoes.json',
  'cpm': '/leis/cpm-questoes.json',
  'cppm': '/leis/cppm-questoes.json',
};

// Slugs que têm banco de questões — usado para montar o composer de simulado
// na biblioteca (só oferece leis que realmente têm questões).
export const LEIS_COM_QUESTOES: string[] = Object.keys(QUESTOES_ARQUIVO);

const _cache = new Map<string, Promise<LeiQuestao[]>>();

export function getQuestoesLei(slug: string): Promise<LeiQuestao[]> {
  const cached = _cache.get(slug);
  if (cached) return cached;

  const arquivo = QUESTOES_ARQUIVO[slug];
  if (!arquivo) return Promise.resolve([]);

  const promise = fetch(arquivo)
    .then((res) => {
      if (!res.ok) throw new Error(`Erro ao carregar questões (${res.status})`);
      return res.json() as Promise<LeiQuestao[]>;
    })
    .catch((e) => {
      _cache.delete(slug);
      throw e;
    });

  _cache.set(slug, promise);
  return promise;
}

export function agruparPorArtigo(questoes: LeiQuestao[]): Map<string, LeiQuestao[]> {
  const map = new Map<string, LeiQuestao[]>();
  for (const q of questoes) {
    const lista = map.get(q.artigoKey) ?? [];
    lista.push(q);
    map.set(q.artigoKey, lista);
  }
  return map;
}

export function embaralhar<T>(arr: T[]): T[] {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// ─── Respostas do banco de questões ─────────────────────────────────────────
// Uma linha por (usuário, questão) em lei_questao_respostas; re-responder
// sobrescreve (upsert). Alimenta os filtros "não respondidas" e "que errei".

export interface LeiQuestaoResposta {
  questaoId: string;
  resposta: boolean;
  acertou: boolean;
}

export async function upsertRespostaQuestao(input: {
  leiSlug: string;
  questaoId: string;
  resposta: boolean;
  acertou: boolean;
}): Promise<void> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from('lei_questao_respostas').upsert(
    {
      user_id:    userId,
      lei_slug:   input.leiSlug,
      questao_id: input.questaoId,
      resposta:   input.resposta,
      acertou:    input.acertou,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,questao_id' },
  );
  if (error) throw new Error('Erro ao salvar resposta: ' + error.message);
}

export async function listRespostasByLei(leiSlug: string): Promise<Map<string, LeiQuestaoResposta>> {
  const ctx = await tryGetUser();
  if (!ctx) return new Map();
  const { supabase, userId } = ctx;

  const { data, error } = await supabase
    .from('lei_questao_respostas')
    .select('questao_id, resposta, acertou')
    .eq('user_id', userId)
    .eq('lei_slug', leiSlug);

  if (error) throw new Error('Erro ao carregar respostas: ' + error.message);
  const map = new Map<string, LeiQuestaoResposta>();
  for (const r of data ?? []) {
    map.set(r.questao_id as string, {
      questaoId: r.questao_id as string,
      resposta: r.resposta as boolean,
      acertou: r.acertou as boolean,
    });
  }
  return map;
}

export async function clearRespostasByLei(leiSlug: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from('lei_questao_respostas')
    .delete()
    .eq('user_id', userId)
    .eq('lei_slug', leiSlug);
  if (error) throw new Error('Erro ao limpar respostas: ' + error.message);
}

// ─── Histórico de simulados ──────────────────────────────────────────────────

export interface LeiSimuladoResposta {
  artigoKey: string;
  gabarito: boolean;
  resposta: boolean;
  acertou: boolean;
}

export interface LeiSimuladoSession {
  id: string;
  user_id: string;
  lei_slug: string;
  total: number;
  certas: number;
  elapsed_secs: number;
  respostas: LeiSimuladoResposta[];
  created_at: string;
}

export async function saveLeiSimuladoSession(input: {
  leiSlug: string;
  total: number;
  certas: number;
  elapsedSecs: number;
  respostas: LeiSimuladoResposta[];
}): Promise<void> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from('lei_simulado_sessions').insert({
    user_id:      userId,
    lei_slug:     input.leiSlug,
    total:        input.total,
    certas:       input.certas,
    elapsed_secs: input.elapsedSecs,
    respostas:    input.respostas,
  });
  if (error) throw new Error('Erro ao salvar resultado do simulado: ' + error.message);
}

export async function listLeiSimuladoSessions(leiSlug: string): Promise<LeiSimuladoSession[]> {
  const ctx = await tryGetUser();
  if (!ctx) return [];
  const { supabase, userId } = ctx;

  const { data, error } = await supabase
    .from('lei_simulado_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('lei_slug', leiSlug)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw new Error('Erro ao listar simulados: ' + error.message);
  return (data ?? []) as LeiSimuladoSession[];
}
