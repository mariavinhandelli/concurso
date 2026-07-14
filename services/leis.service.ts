// services/leis.service.ts
// Conteúdo do Vade Mecum: as leis vivem como JSON estático em public/leis/
// (mesmo padrão de data/jurisprudencias.ts — conteúdo global fora do banco).
// As interações pessoais (grifos, anotações, revisão) ficam em
// leiInteracoes.service.ts, isoladas por usuário no Supabase.
'use client';

export type LeiIncidencia = 'baixa' | 'media' | 'alta' | 'muito_alta';

export interface LeiBloco {
  id: string;            // estável dentro do artigo ("b1", "b2"…) — âncora dos grifos
  rotulo: string | null; // "§ 1º", "I –", "a)" … null = caput/continuação
  texto: string;
  nivel: 0 | 1 | 2;
}

export interface LeiArtigo {
  key: string;           // "cf-88:37" — chave global usada em lei_interacoes
  ordem: number;
  numero: string;        // "37", "5", "103-A"
  rotulo: string;        // "Art. 37"
  caminho: string | null;
  incidencia: LeiIncidencia;
  incidenciaNota: string | null;
  revogado: boolean;
  blocos: LeiBloco[];
}

export interface Lei {
  slug: string;
  nome: string;
  nomeCurto: string;
  ano: number;
  disciplina: string;
  descricao: string;
  fonteUrl: string;
  geradoEm: string;
  artigos: LeiArtigo[];
}

export interface LeiMeta {
  slug: string;
  nome: string;
  nomeCurto: string;
  ano: number;
  disciplina: string;
  descricao: string;
  arquivo: string;
  totalArtigos: number;
}

// Catálogo de leis disponíveis. Novas leis: gerar o JSON e registrar aqui.
export const LEIS_CATALOG: LeiMeta[] = [
  {
    slug: 'cf-88',
    nome: 'Constituição da República Federativa do Brasil de 1988',
    nomeCurto: 'CF/88',
    ano: 1988,
    disciplina: 'Direito Constitucional',
    descricao: 'Texto compilado e atualizado (fonte: Planalto). Corpo permanente — arts. 1º a 250.',
    arquivo: '/leis/cf-88.json',
    totalArtigos: 276,
  },
  {
    slug: 'lei-14133',
    nome: 'Lei nº 14.133, de 1º de abril de 2021 — Licitações e Contratos Administrativos',
    nomeCurto: 'Lei 14.133/21',
    ano: 2021,
    disciplina: 'Direito Administrativo',
    descricao: 'Nova Lei de Licitações. Texto compilado e atualizado (fonte: Planalto), com alterações até a Lei 15.266/2025.',
    arquivo: '/leis/lei-14133.json',
    totalArtigos: 196,
  },
  {
    slug: 'lei-8429',
    nome: 'Lei nº 8.429, de 2 de junho de 1992 — Improbidade Administrativa',
    nomeCurto: 'Lei 8.429/92',
    ano: 1992,
    disciplina: 'Direito Administrativo',
    descricao: 'Lei de Improbidade com a reforma integral da Lei 14.230/2021. Texto compilado (fonte: Planalto).',
    arquivo: '/leis/lei-8429.json',
    totalArtigos: 34,
  },
  {
    slug: 'lei-9784',
    nome: 'Lei nº 9.784, de 29 de janeiro de 1999 — Processo Administrativo Federal',
    nomeCurto: 'Lei 9.784/99',
    ano: 1999,
    disciplina: 'Direito Administrativo',
    descricao: 'Regula o processo administrativo na Administração Pública Federal. Texto compilado (fonte: Planalto).',
    arquivo: '/leis/lei-9784.json',
    totalArtigos: 80,
  },
  {
    slug: 'lei-12527',
    nome: 'Lei nº 12.527, de 18 de novembro de 2011 — Lei de Acesso à Informação (LAI)',
    nomeCurto: 'LAI 12.527/11',
    ano: 2011,
    disciplina: 'Direito Administrativo',
    descricao: 'Texto compilado e atualizado (fonte: Planalto), com alterações até a Lei 15.141/2025.',
    arquivo: '/leis/lei-12527.json',
    totalArtigos: 49,
  },
  {
    slug: 'lgpd',
    nome: 'Lei nº 13.709, de 14 de agosto de 2018 — Lei Geral de Proteção de Dados Pessoais (LGPD)',
    nomeCurto: 'LGPD',
    ano: 2018,
    disciplina: 'Legislação Especial',
    descricao: 'Texto compilado e atualizado (fonte: Planalto), com alterações até as Leis 15.352 e 15.452 de 2026.',
    arquivo: '/leis/lgpd.json',
    totalArtigos: 79,
  },
  {
    slug: 'go-13800',
    nome: 'Lei Estadual nº 13.800, de 18 de janeiro de 2001 — Processo Administrativo (Goiás)',
    nomeCurto: 'GO 13.800/01',
    ano: 2001,
    disciplina: 'Legislação Estadual — Goiás',
    descricao: 'Processo administrativo na Administração Pública de Goiás. Espelha a Lei 9.784/99 na numeração dos artigos-chave (fonte: Casa Civil GO).',
    arquivo: '/leis/go-13800.json',
    totalArtigos: 70,
  },
  {
    slug: 'cp',
    nome: 'Decreto-Lei nº 2.848, de 7 de dezembro de 1940 — Código Penal',
    nomeCurto: 'Código Penal',
    ano: 1940,
    disciplina: 'Direito Penal',
    descricao: 'Texto compilado e atualizado (fonte: Planalto), gerado direto do compilado vigente — inclui os arts. 121-A (feminicídio) e 359-M-A/M-B.',
    arquivo: '/leis/cp.json',
    totalArtigos: 423,
  },
  {
    slug: 'cpp',
    nome: 'Decreto-Lei nº 3.689, de 3 de outubro de 1941 — Código de Processo Penal',
    nomeCurto: 'CPP',
    ano: 1941,
    disciplina: 'Direito Processual Penal',
    descricao: 'Texto compilado e atualizado (fonte: Planalto) — inclui juiz das garantias (arts. 3º-A a 3º-F) e ANPP (art. 28-A).',
    arquivo: '/leis/cpp.json',
    totalArtigos: 845,
  },
  {
    slug: 'cpm',
    nome: 'Decreto-Lei nº 1.001, de 21 de outubro de 1969 — Código Penal Militar',
    nomeCurto: 'CPM',
    ano: 1969,
    disciplina: 'Direito Penal Militar',
    descricao: 'Texto compilado e atualizado (fonte: Planalto), com a reforma da Lei 14.688/2023.',
    arquivo: '/leis/cpm.json',
    totalArtigos: 410,
  },
  {
    slug: 'cppm',
    nome: 'Decreto-Lei nº 1.002, de 21 de outubro de 1969 — Código de Processo Penal Militar',
    nomeCurto: 'CPPM',
    ano: 1969,
    disciplina: 'Direito Processual Penal Militar',
    descricao: 'Texto compilado e atualizado (fonte: Planalto).',
    arquivo: '/leis/cppm.json',
    totalArtigos: 716,
  },
  {
    slug: 'lei-8987',
    nome: 'Lei nº 8.987, de 13 de fevereiro de 1995 — Regime de Concessão e Permissão da Prestação de Serviços Públicos',
    nomeCurto: 'Lei 8.987/95',
    ano: 1995,
    disciplina: 'Direito Administrativo',
    descricao: 'Lei das Concessões e Permissões de serviços públicos (art. 175 da CF/88). Texto compilado e atualizado (fonte: Planalto).',
    arquivo: '/leis/lei-8987.json',
    totalArtigos: 52,
  },
  {
    slug: 'lei-11079',
    nome: 'Lei nº 11.079, de 30 de dezembro de 2004 — Normas Gerais para Licitação e Contratação de Parceria Público-Privada',
    nomeCurto: 'Lei 11.079/04 (PPP)',
    ano: 2004,
    disciplina: 'Direito Administrativo',
    descricao: 'Institui as modalidades de PPP (concessão patrocinada e administrativa). Texto compilado e atualizado (fonte: Planalto).',
    arquivo: '/leis/lei-11079.json',
    totalArtigos: 32,
  },
  {
    slug: 'lindb',
    nome: 'Decreto-Lei nº 4.657, de 4 de setembro de 1942 — Lei de Introdução às Normas do Direito Brasileiro (LINDB)',
    nomeCurto: 'LINDB',
    ano: 1942,
    disciplina: 'Direito Administrativo',
    descricao: 'Normas sobre vigência, aplicação e interpretação das leis, incluindo os arts. 20-30 (segurança jurídica na gestão pública, Lei 13.655/2018). Texto compilado e atualizado (fonte: Planalto).',
    arquivo: '/leis/lindb.json',
    totalArtigos: 30,
  },
  {
    slug: 'lei-9637',
    nome: 'Lei nº 9.637, de 15 de maio de 1998 — Qualificação de Organizações Sociais (OS)',
    nomeCurto: 'Lei 9.637/98 (OS)',
    ano: 1998,
    disciplina: 'Direito Administrativo',
    descricao: 'Dispõe sobre a qualificação de entidades como Organizações Sociais e o contrato de gestão. Texto compilado e atualizado (fonte: Planalto).',
    arquivo: '/leis/lei-9637.json',
    totalArtigos: 26,
  },
  {
    slug: 'lei-9790',
    nome: 'Lei nº 9.790, de 23 de março de 1999 — Qualificação de Organizações da Sociedade Civil de Interesse Público (OSCIP)',
    nomeCurto: 'Lei 9.790/99 (OSCIP)',
    ano: 1999,
    disciplina: 'Direito Administrativo',
    descricao: 'Dispõe sobre a qualificação de pessoas jurídicas de direito privado sem fins lucrativos como OSCIP e institui o termo de parceria. Texto compilado e atualizado (fonte: Planalto).',
    arquivo: '/leis/lei-9790.json',
    totalArtigos: 22,
  },
];

const _cache = new Map<string, Promise<Lei>>();

export function getLei(slug: string): Promise<Lei> {
  const cached = _cache.get(slug);
  if (cached) return cached;

  const meta = LEIS_CATALOG.find((l) => l.slug === slug);
  if (!meta) return Promise.reject(new Error(`Lei não encontrada: ${slug}`));

  const promise = fetch(meta.arquivo)
    .then((res) => {
      if (!res.ok) throw new Error(`Erro ao carregar ${meta.nomeCurto} (${res.status})`);
      return res.json() as Promise<Lei>;
    })
    .catch((e) => {
      _cache.delete(slug); // não cacheia falha — permite retry
      throw e;
    });

  _cache.set(slug, promise);
  return promise;
}

// Índice do artigo dentro da chave "slug:numero" (para navegação/deep-link).
export function artigoNumeroFromKey(key: string): string {
  return key.slice(key.indexOf(':') + 1);
}

export const INCIDENCIA_LABEL: Record<LeiIncidencia, string> = {
  muito_alta: 'Muito alta',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};
