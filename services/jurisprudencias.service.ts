// services/jurisprudencias.service.ts
// Fonte de dados: data/jurisprudencias.ts (array local tipado).
// Interações pessoais (favorito, estrelas, anotações, revisão) ficam em
// jurisInteracoes.service.ts, isoladas por usuário no Supabase.

import { createClient } from '@/lib/supabase/client';
import { jurisprudencias as ALL } from '@/data/jurisprudencias';

export type JurisTipo = 'sumula' | 'sumula_vinculante' | 'acordao' | 'decisao_monocratica' | 'informativo' | 'outro';

export interface JurisRelacionada {
  processo: string;
  relacao: string;
  motivo: string;
}
export type JurisStatus = 'vigente' | 'cancelada' | 'substituida' | 'revisada';
export type JurisIncidencia = 'baixa' | 'media' | 'alta' | 'muito_alta';

export interface Jurisprudencia {
  id: string;
  created_by: string;

  // Identificação
  tribunal: string;
  orgao_julgador: string | null;
  tipo: JurisTipo;
  informativo: string | null;
  processo: string | null;
  relator: string | null;
  data_julgamento: string | null;
  data_publicacao: string | null;
  status: JurisStatus;

  // Classificação
  disciplina: string;
  materia: string | null;
  assunto: string | null;
  subassunto: string | null;

  // Conteúdo
  dispositivos_relacionados: string | null;
  tese: string;
  resumo: string | null;
  explicacao_comparativa: string | null;
  por_que_aplica: string | null;
  esquema_visual: string | null;
  exemplo_pratico: string | null;
  pegadinhas: string | null;
  tese_banca: string | null;
  como_banca_cobra: string | null;
  palavras_chave: string[];

  // Importância (oficial, definida por quem cadastrou)
  estrelas: 1 | 2 | 3 | 4 | 5;
  incidencia_concursos: JurisIncidencia;

  // Modo flashcard (opcional)
  flashcard_frente: string | null;
  flashcard_verso: string | null;

  // Modo questão C/E (opcional)
  questao_enunciado: string | null;
  questao_gabarito: boolean | null; // true = Certo, false = Errado
  questao_comentario: string | null;

  // Campos exclusivos de súmulas (opcional)
  numero_sumula?: string | null;
  titulo?: string | null;
  texto_sumula?: string | null;
  data_aprovacao?: string | null;
  origem_publicacao?: string | null;
  cancelada?: boolean;
  superada?: boolean;
  superada_parcialmente?: boolean;
  superada_por?: string[];

  // Evolução jurisprudencial (opcional)
  supera_entendimento_anterior?: boolean;
  observacao_evolucao?: string | null;

  // Jurisprudências relacionadas (opcional)
  jurisprudencias_relacionadas?: JurisRelacionada[];

  created_at: string;
  updated_at: string;
}

export type JurisprudenciaInput = Omit<Jurisprudencia, 'id' | 'created_by' | 'created_at' | 'updated_at'>;

export interface JurisFilters {
  search?: string;
  tribunal?: string;
  tipo?: JurisTipo;
  disciplina?: string;
  materia?: string;
  status?: JurisStatus;
  estrelas?: number;
  incidencia?: JurisIncidencia;
  ano?: number;
}

export const TRIBUNAIS = [
  'STF', 'STJ', 'TST', 'TSE', 'STM',
  'TRF1', 'TRF2', 'TRF3', 'TRF4', 'TRF5', 'TRF6',
  'TCU', 'TCE', 'CNJ', 'CNMP',
  'Outro',
];

export const TIPOS: { value: JurisTipo; label: string }[] = [
  { value: 'sumula', label: 'Súmula' },
  { value: 'acordao', label: 'Acórdão' },
  { value: 'decisao_monocratica', label: 'Decisão Monocrática' },
  { value: 'informativo', label: 'Informativo' },
  { value: 'outro', label: 'Outro' },
];

export const STATUS_OPTIONS: { value: JurisStatus; label: string }[] = [
  { value: 'vigente', label: 'Vigente' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'substituida', label: 'Substituída' },
  { value: 'revisada', label: 'Revisada' },
];

export const INCIDENCIA_OPTIONS: { value: JurisIncidencia; label: string }[] = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'muito_alta', label: 'Muito Alta' },
];

// Disciplinas-padrão do hub (cards principais). Mesmo que o usuário cadastre
// outras, estas sempre aparecem como atalho de navegação.
export const DISCIPLINAS_HUB = [
  'Constitucional', 'Administrativo', 'Penal', 'Processo Penal',
  'Civil', 'Processo Civil', 'Trabalho', 'Eleitoral',
  'Tributário', 'Previdenciário', 'Penal e Proc. Penal Militar',
];

const INCIDENCIA_ORDER: Record<JurisIncidencia, number> = {
  muito_alta: 4, alta: 3, media: 2, baixa: 1,
};

function applyFilters(items: Jurisprudencia[], filters: JurisFilters): Jurisprudencia[] {
  let result = items;
  if (filters.tribunal) result = result.filter((j) => j.tribunal === filters.tribunal);
  if (filters.tipo) result = result.filter((j) => j.tipo === filters.tipo);
  if (filters.disciplina) {
    const d = filters.disciplina.toLowerCase();
    result = result.filter((j) =>
      normalizeDisciplina(j.disciplina).toLowerCase() === d ||
      j.disciplina.toLowerCase() === d
    );
  }
  if (filters.materia) {
    const m = filters.materia.toLowerCase();
    result = result.filter((j) => j.materia?.toLowerCase().includes(m));
  }
  if (filters.status) result = result.filter((j) => j.status === filters.status);
  if (filters.estrelas) result = result.filter((j) => j.estrelas === filters.estrelas);
  if (filters.incidencia) result = result.filter((j) => j.incidencia_concursos === filters.incidencia);
  if (filters.ano) {
    result = result.filter((j) => j.data_julgamento?.startsWith(String(filters.ano)));
  }
  if (filters.search) {
    const s = filters.search.toLowerCase();
    result = result.filter((j) =>
      j.tese.toLowerCase().includes(s) ||
      j.tribunal.toLowerCase().includes(s) ||
      j.disciplina.toLowerCase().includes(s) ||
      j.palavras_chave.some((k) => k.toLowerCase().includes(s))
    );
  }
  return result;
}

async function requireUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Você precisa estar logado.');
  return user;
}

async function fetchUserCreated(supabase: ReturnType<typeof createClient>): Promise<Jurisprudencia[]> {
  const staticIds = new Set((ALL as Jurisprudencia[]).map((j) => j.id));
  const { data } = await supabase.from('jurisprudencias').select('*').order('created_at', { ascending: false });
  return ((data ?? []) as Jurisprudencia[]).filter((item) => !staticIds.has(item.id));
}

export async function listJurisprudencias(filters: JurisFilters = {}): Promise<Jurisprudencia[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Você precisa estar logado.');
  const userItems = await fetchUserCreated(supabase);
  const merged = [...userItems, ...(ALL as Jurisprudencia[])];
  return applyFilters(merged, filters)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 200);
}

export async function listUltimasAdicionadas(limit = 5): Promise<Jurisprudencia[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const userItems = await fetchUserCreated(supabase);
  return [...userItems, ...(ALL as Jurisprudencia[])]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export async function listMaisCobradas(limit = 5): Promise<Jurisprudencia[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const userItems = await fetchUserCreated(supabase);
  return [...userItems, ...(ALL as Jurisprudencia[])]
    .filter((j) => j.incidencia_concursos === 'alta' || j.incidencia_concursos === 'muito_alta')
    .sort((a, b) => {
      const diff = INCIDENCIA_ORDER[b.incidencia_concursos] - INCIDENCIA_ORDER[a.incidencia_concursos];
      return diff !== 0 ? diff : b.estrelas - a.estrelas;
    })
    .slice(0, limit);
}

export async function getJurisprudencia(id: string): Promise<Jurisprudencia | null> {
  const staticItem = (ALL as Jurisprudencia[]).find((j) => j.id === id);
  if (staticItem) return staticItem;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('jurisprudencias').select('*').eq('id', id).maybeSingle();
  return (data as Jurisprudencia | null) ?? null;
}

export async function createJurisprudencia(input: JurisprudenciaInput): Promise<Jurisprudencia> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { data, error } = await supabase
    .from('jurisprudencias')
    .insert({ ...input, created_by: user.id })
    .select()
    .single();

  if (error) throw new Error('Erro ao criar jurisprudência: ' + error.message);
  return data as Jurisprudencia;
}

export async function updateJurisprudencia(id: string, input: Partial<JurisprudenciaInput>): Promise<Jurisprudencia> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { data, error } = await supabase
    .from('jurisprudencias')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('created_by', user.id)
    .select()
    .single();

  if (error) throw new Error('Erro ao atualizar jurisprudência: ' + error.message);
  return data as Jurisprudencia;
}

export async function deleteJurisprudencia(id: string): Promise<void> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase
    .from('jurisprudencias')
    .delete()
    .eq('id', id)
    .eq('created_by', user.id);

  if (error) throw new Error('Erro ao apagar jurisprudência: ' + error.message);
}

export async function listDistinct(field: 'tribunal' | 'disciplina' | 'materia'): Promise<string[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const userItems = await fetchUserCreated(supabase);
  const values = [...userItems, ...(ALL as Jurisprudencia[])]
    .map((j) => j[field])
    .filter((v): v is string => v != null && v !== '');
  return [...new Set(values)].sort();
}

const DISCIPLINA_ALIAS: Record<string, string> = {
  // Penal Militar
  'Penal Militar': 'Penal e Proc. Penal Militar',
  'Processual Penal Militar': 'Penal e Proc. Penal Militar',
  'Direito Penal Militar': 'Penal e Proc. Penal Militar',
  'Direito Processual Penal Militar': 'Penal e Proc. Penal Militar',
  'Direito Penal e Processual Penal Militar': 'Penal e Proc. Penal Militar',
  'Penal e Processual Penal Militar': 'Penal e Proc. Penal Militar',
  // Processo Penal
  'Direito Processual Penal': 'Processo Penal',
  'Processual Penal': 'Processo Penal',
  // Processo Civil
  'Direito Processual Civil': 'Processo Civil',
  'Processual Civil': 'Processo Civil',
  // Trabalho
  'Direito do Trabalho': 'Trabalho',
  'do Trabalho': 'Trabalho',
  'Direito Trabalhista': 'Trabalho',
  'Trabalhista': 'Trabalho',
};

// Normaliza "Direito Penal" → "Penal", "Direito Civil" → "Civil", etc.
// para bater com as chaves do DISCIPLINAS_HUB.
function normalizeDisciplina(disciplina: string): string {
  if (DISCIPLINA_ALIAS[disciplina]) return DISCIPLINA_ALIAS[disciplina];
  const stripped = disciplina.replace(/^Direito\s+/i, '');
  if (DISCIPLINA_ALIAS[stripped]) return DISCIPLINA_ALIAS[stripped];
  if (DISCIPLINAS_HUB.includes(stripped)) return stripped;
  if (DISCIPLINAS_HUB.includes(disciplina)) return disciplina;
  return disciplina;
}

export async function countByDisciplina(): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  const userItems = await fetchUserCreated(supabase);
  const counts: Record<string, number> = {};
  for (const j of [...userItems, ...(ALL as Jurisprudencia[])]) {
    const key = normalizeDisciplina(j.disciplina);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function getJurisprudenciaById(id: string): Jurisprudencia | undefined {
  return (ALL as Jurisprudencia[]).find((j) => j.id === id);
}
