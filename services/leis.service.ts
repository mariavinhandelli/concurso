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
    totalArtigos: 424,
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
    totalArtigos: 411,
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
  {
    slug: 'lei-8112',
    nome: 'Lei nº 8.112, de 11 de dezembro de 1990 — Regime Jurídico dos Servidores Públicos Civis da União',
    nomeCurto: 'Lei 8.112/90',
    ano: 1990,
    disciplina: 'Direito Administrativo',
    descricao: 'Estatuto dos servidores públicos federais: provimento, vacância, direitos e vantagens, regime disciplinar, processo administrativo disciplinar. Texto compilado e atualizado (fonte: Planalto).',
    arquivo: '/leis/lei-8112.json',
    totalArtigos: 262,
  },
  {
    slug: 'lei-12846',
    nome: 'Lei nº 12.846, de 1º de agosto de 2013 — Lei Anticorrupção (Responsabilização de Pessoas Jurídicas)',
    nomeCurto: 'Lei 12.846/13',
    ano: 2013,
    disciplina: 'Direito Administrativo',
    descricao: 'Responsabilização administrativa e civil de pessoas jurídicas por atos contra a administração pública, nacional ou estrangeira. Texto compilado e atualizado (fonte: Planalto).',
    arquivo: '/leis/lei-12846.json',
    totalArtigos: 31,
  },
  {
    slug: 'cdc',
    nome: 'Lei nº 8.078, de 11 de setembro de 1990 — Código de Defesa do Consumidor',
    nomeCurto: 'CDC',
    ano: 1990,
    disciplina: 'Direito do Consumidor',
    descricao: 'Texto compilado e atualizado (fonte: Planalto).',
    arquivo: '/leis/cdc.json',
    totalArtigos: 130,
  },
  {
    slug: 'ctn',
    nome: 'Lei nº 5.172, de 25 de outubro de 1966 — Código Tributário Nacional',
    nomeCurto: 'CTN',
    ano: 1966,
    disciplina: 'Direito Tributário',
    descricao: 'Texto compilado e atualizado (fonte: Planalto).',
    arquivo: '/leis/ctn.json',
    totalArtigos: 211,
  },
  {
    slug: 'cc',
    nome: 'Lei nº 10.406, de 10 de janeiro de 2002 — Código Civil',
    nomeCurto: 'Código Civil',
    ano: 2002,
    disciplina: 'Direito Civil',
    descricao: 'Texto compilado e atualizado (fonte: Planalto).',
    arquivo: '/leis/cc.json',
    totalArtigos: 2092,
  },
  {
    slug: 'cpc',
    nome: 'Lei nº 13.105, de 16 de março de 2015 — Código de Processo Civil',
    nomeCurto: 'CPC',
    ano: 2015,
    disciplina: 'Direito Processual Civil',
    descricao: 'Texto compilado e atualizado (fonte: Planalto).',
    arquivo: '/leis/cpc.json',
    totalArtigos: 1073,
  },
  {
    slug: 'clt',
    nome: 'Decreto-Lei nº 5.452, de 1º de maio de 1943 — Consolidação das Leis do Trabalho (CLT)',
    nomeCurto: 'CLT',
    ano: 1943,
    disciplina: 'Direito do Trabalho',
    descricao: 'Texto compilado e atualizado (fonte: Planalto), com a Reforma Trabalhista (Lei 13.467/2017).',
    arquivo: '/leis/clt.json',
    totalArtigos: 1027,
  },
  {
    slug: 'eca',
    nome: 'Lei nº 8.069, de 13 de julho de 1990 — Estatuto da Criança e do Adolescente (ECA)',
    nomeCurto: 'ECA',
    ano: 1990,
    disciplina: 'Direito da Criança e do Adolescente',
    descricao: 'Texto compilado e atualizado (fonte: Planalto).',
    arquivo: '/leis/eca.json',
    totalArtigos: 325,
  },
  {
    slug: 'lei-12016',
    nome: 'Lei nº 12.016, de 7 de agosto de 2009 — Mandado de Segurança',
    nomeCurto: 'Lei 12.016/09 (MS)',
    ano: 2009,
    disciplina: 'Direito Processual Civil',
    descricao: 'Disciplina o mandado de segurança individual e coletivo. Texto compilado e atualizado (fonte: Planalto).',
    arquivo: '/leis/lei-12016.json',
    totalArtigos: 29,
  },
  {
    slug: 'lei-7347',
    nome: 'Lei nº 7.347, de 24 de julho de 1985 — Ação Civil Pública',
    nomeCurto: 'Lei 7.347/85 (ACP)',
    ano: 1985,
    disciplina: 'Direito Processual Civil',
    descricao: 'Disciplina a ação civil pública de responsabilidade por danos ao meio ambiente, consumidor e outros interesses difusos/coletivos. Texto compilado e atualizado (fonte: Planalto).',
    arquivo: '/leis/lei-7347.json',
    totalArtigos: 23,
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

// Hub de Editais (Fase 3): dado o nome de uma matéria da Focali, encontra a
// disciplina correspondente no catálogo de leis — as taxonomias diferem
// ("Administrativo" na matéria vs "Direito Administrativo" aqui). Retorna a
// string EXATA de LeiMeta.disciplina (é o que o filtro do Vade Mecum compara),
// ou null quando a matéria não tem lei seca no catálogo (ex.: Língua Portuguesa).
export function leiDisciplinaForSubject(subjectName: string): string | null {
  const norm = (v: string) =>
    v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/^direito\s+/, '').trim();
  const alvo = norm(subjectName);
  if (!alvo) return null;
  const hit = LEIS_CATALOG.find((l) => norm(l.disciplina) === alvo);
  return hit?.disciplina ?? null;
}

export const INCIDENCIA_LABEL: Record<LeiIncidencia, string> = {
  muito_alta: 'Muito alta',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};
