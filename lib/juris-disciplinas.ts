// lib/juris-disciplinas.ts
// Taxonomia de disciplinas do módulo de jurisprudências — SEM importar o banco
// de julgados (data/jurisprudencias, ~800KB). Consumidores fora do módulo de
// juris (ex.: Hub do Concurso) importam daqui para não arrastar o dataset
// inteiro para o bundle. jurisprudencias.service re-exporta por compat.

// Disciplinas-padrão do hub (cards principais). Mesmo que o usuário cadastre
// outras, estas sempre aparecem como atalho de navegação.
export const DISCIPLINAS_HUB = [
  'Constitucional', 'Administrativo', 'Controle Externo', 'Penal', 'Processo Penal',
  'Civil', 'Processo Civil', 'Trabalho', 'Eleitoral',
  'Tributário', 'Previdenciário', 'Penal e Proc. Penal Militar',
];

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
// Exportada: outros módulos (ex. hub de Targets) usam para saber sob qual
// disciplina filtrar jurisprudências relacionadas a uma matéria da Focali —
// os nomes das matérias não usam a mesma taxonomia (ver DISCIPLINA_ALIAS).
export function normalizeDisciplina(disciplina: string): string {
  if (DISCIPLINA_ALIAS[disciplina]) return DISCIPLINA_ALIAS[disciplina];
  const stripped = disciplina.replace(/^Direito\s+/i, '');
  if (DISCIPLINA_ALIAS[stripped]) return DISCIPLINA_ALIAS[stripped];
  if (DISCIPLINAS_HUB.includes(stripped)) return stripped;
  if (DISCIPLINAS_HUB.includes(disciplina)) return disciplina;
  return disciplina;
}
