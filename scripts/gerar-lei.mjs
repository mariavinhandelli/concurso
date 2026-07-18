// scripts/gerar-lei.mjs
// Gera public/leis/<slug>.json a partir do texto COMPILADO do Planalto.
// Uso:  node scripts/gerar-lei.mjs cp        (ou cpp, cpm, cppm)
//       node scripts/gerar-lei.mjs cp --from caminho/local.htm   (arquivo já baixado)
//
// O que ele faz:
//  1. Baixa o HTML compilado (windows-1252) do Planalto — sempre a versão vigente.
//  2. Descarta redações antigas (<strike>) e anotações "(Redação dada...)" etc.
//  3. Monta o caminho estrutural (PARTE › LIVRO › TÍTULO › CAPÍTULO › SEÇÃO).
//  4. Divide cada artigo em blocos (caput, §§, incisos, alíneas) no schema de
//     services/leis.service.ts. Rubricas ("Homicídio simples") viram blocos de texto.
//  5. Marca artigos revogados (revogado: true, corpo "(Revogado)").
//
// Depois de gerar, registre/atualize a lei em LEIS_CATALOG (services/leis.service.ts)
// com o totalArtigos impresso no final.

import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LEIS = {
  cp: {
    slug: 'cp',
    nome: 'Decreto-Lei nº 2.848, de 7 de dezembro de 1940 — Código Penal',
    nomeCurto: 'Código Penal',
    ano: 1940,
    disciplina: 'Direito Penal',
    descricao: 'Texto compilado e atualizado (fonte: Planalto), sem redações revogadas.',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm',
  },
  cpp: {
    slug: 'cpp',
    nome: 'Decreto-Lei nº 3.689, de 3 de outubro de 1941 — Código de Processo Penal',
    nomeCurto: 'CPP',
    ano: 1941,
    disciplina: 'Direito Processual Penal',
    descricao: 'Texto compilado e atualizado (fonte: Planalto), sem redações revogadas.',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689compilado.htm',
  },
  cpm: {
    slug: 'cpm',
    nome: 'Decreto-Lei nº 1.001, de 21 de outubro de 1969 — Código Penal Militar',
    nomeCurto: 'CPM',
    ano: 1969,
    disciplina: 'Direito Penal Militar',
    descricao: 'Texto compilado e atualizado (fonte: Planalto), sem redações revogadas.',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del1001compilado.htm',
  },
  cppm: {
    slug: 'cppm',
    nome: 'Decreto-Lei nº 1.002, de 21 de outubro de 1969 — Código de Processo Penal Militar',
    nomeCurto: 'CPPM',
    ano: 1969,
    disciplina: 'Direito Processual Penal Militar',
    descricao: 'Texto compilado e atualizado (fonte: Planalto), sem redações revogadas.',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del1002compilado.htm',
  },
  'lei-8987': {
    slug: 'lei-8987',
    nome: 'Lei nº 8.987, de 13 de fevereiro de 1995 — Regime de Concessão e Permissão da Prestação de Serviços Públicos',
    nomeCurto: 'Lei 8.987/95',
    ano: 1995,
    disciplina: 'Direito Administrativo',
    descricao: 'Lei das Concessões e Permissões de serviços públicos (art. 175 da CF/88). Texto compilado e atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8987cons.htm',
  },
  'lei-11079': {
    slug: 'lei-11079',
    nome: 'Lei nº 11.079, de 30 de dezembro de 2004 — Normas Gerais para Licitação e Contratação de Parceria Público-Privada',
    nomeCurto: 'Lei 11.079/04 (PPP)',
    ano: 2004,
    disciplina: 'Direito Administrativo',
    descricao: 'Institui as modalidades de PPP (concessão patrocinada e administrativa). Texto compilado e atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l11079.htm',
  },
  lindb: {
    slug: 'lindb',
    nome: 'Decreto-Lei nº 4.657, de 4 de setembro de 1942 — Lei de Introdução às Normas do Direito Brasileiro (LINDB)',
    nomeCurto: 'LINDB',
    ano: 1942,
    disciplina: 'Direito Administrativo',
    descricao: 'Normas sobre vigência, aplicação e interpretação das leis, incluindo os arts. 20-30 (segurança jurídica na gestão pública, Lei 13.655/2018). Texto compilado e atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del4657compilado.htm',
  },
  'lei-9637': {
    slug: 'lei-9637',
    nome: 'Lei nº 9.637, de 15 de maio de 1998 — Qualificação de Organizações Sociais (OS)',
    nomeCurto: 'Lei 9.637/98 (OS)',
    ano: 1998,
    disciplina: 'Direito Administrativo',
    descricao: 'Dispõe sobre a qualificação de entidades como Organizações Sociais e o contrato de gestão. Texto compilado e atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l9637.htm',
  },
  'lei-9790': {
    slug: 'lei-9790',
    nome: 'Lei nº 9.790, de 23 de março de 1999 — Qualificação de Organizações da Sociedade Civil de Interesse Público (OSCIP)',
    nomeCurto: 'Lei 9.790/99 (OSCIP)',
    ano: 1999,
    disciplina: 'Direito Administrativo',
    descricao: 'Dispõe sobre a qualificação de pessoas jurídicas de direito privado sem fins lucrativos como OSCIP e institui o termo de parceria. Texto compilado e atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l9790.htm',
  },
  'lei-8112': {
    slug: 'lei-8112',
    nome: 'Lei nº 8.112, de 11 de dezembro de 1990 — Regime Jurídico dos Servidores Públicos Civis da União',
    nomeCurto: 'Lei 8.112/90',
    ano: 1990,
    disciplina: 'Direito Administrativo',
    descricao: 'Estatuto dos servidores públicos federais: provimento, vacância, direitos e vantagens, regime disciplinar, processo administrativo disciplinar. Texto compilado e atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm',
  },
  'lei-12846': {
    slug: 'lei-12846',
    nome: 'Lei nº 12.846, de 1º de agosto de 2013 — Lei Anticorrupção (Responsabilização de Pessoas Jurídicas)',
    nomeCurto: 'Lei 12.846/13',
    ano: 2013,
    disciplina: 'Direito Administrativo',
    descricao: 'Responsabilização administrativa e civil de pessoas jurídicas por atos contra a administração pública, nacional ou estrangeira. Texto compilado e atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12846.htm',
  },
  cdc: {
    slug: 'cdc',
    nome: 'Lei nº 8.078, de 11 de setembro de 1990 — Código de Defesa do Consumidor',
    nomeCurto: 'CDC',
    ano: 1990,
    disciplina: 'Direito do Consumidor',
    descricao: 'Texto compilado e atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',
  },
  ctn: {
    slug: 'ctn',
    nome: 'Lei nº 5.172, de 25 de outubro de 1966 — Código Tributário Nacional',
    nomeCurto: 'CTN',
    ano: 1966,
    disciplina: 'Direito Tributário',
    descricao: 'Texto compilado e atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l5172compilado.htm',
  },
  cc: {
    slug: 'cc',
    nome: 'Lei nº 10.406, de 10 de janeiro de 2002 — Código Civil',
    nomeCurto: 'Código Civil',
    ano: 2002,
    disciplina: 'Direito Civil',
    descricao: 'Texto compilado e atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm',
  },
  cpc: {
    slug: 'cpc',
    nome: 'Lei nº 13.105, de 16 de março de 2015 — Código de Processo Civil',
    nomeCurto: 'CPC',
    ano: 2015,
    disciplina: 'Direito Processual Civil',
    descricao: 'Texto compilado e atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm',
  },
  clt: {
    slug: 'clt',
    nome: 'Decreto-Lei nº 5.452, de 1º de maio de 1943 — Consolidação das Leis do Trabalho (CLT)',
    nomeCurto: 'CLT',
    ano: 1943,
    disciplina: 'Direito do Trabalho',
    descricao: 'Texto compilado e atualizado (fonte: Planalto), com a Reforma Trabalhista (Lei 13.467/2017).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm',
  },
  eca: {
    slug: 'eca',
    nome: 'Lei nº 8.069, de 13 de julho de 1990 — Estatuto da Criança e do Adolescente (ECA)',
    nomeCurto: 'ECA',
    ano: 1990,
    disciplina: 'Direito da Criança e do Adolescente',
    descricao: 'Texto compilado e atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8069compilado.htm',
  },
  'lei-12016': {
    slug: 'lei-12016',
    nome: 'Lei nº 12.016, de 7 de agosto de 2009 — Mandado de Segurança',
    nomeCurto: 'Lei 12.016/09 (MS)',
    ano: 2009,
    disciplina: 'Direito Processual Civil',
    descricao: 'Disciplina o mandado de segurança individual e coletivo. Texto compilado e atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l12016.htm',
  },
  'lei-7347': {
    slug: 'lei-7347',
    nome: 'Lei nº 7.347, de 24 de julho de 1985 — Ação Civil Pública',
    nomeCurto: 'Lei 7.347/85 (ACP)',
    ano: 1985,
    disciplina: 'Direito Processual Civil',
    descricao: 'Disciplina a ação civil pública de responsabilidade por danos ao meio ambiente, consumidor e outros interesses difusos/coletivos. Texto compilado e atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l7347compilada.htm',
  },
  'lei-11343': {
    slug: 'lei-11343',
    nome: 'Lei nº 11.343, de 23 de agosto de 2006 — Lei de Drogas',
    nomeCurto: 'Lei 11.343/06 (Drogas)',
    ano: 2006,
    disciplina: 'Legislação Penal Especial',
    descricao: 'Sistema Nacional de Políticas Públicas sobre Drogas (Sisnad); tipos penais e procedimento. Texto atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11343.htm',
  },
  'lei-10826': {
    slug: 'lei-10826',
    nome: 'Lei nº 10.826, de 22 de dezembro de 2003 — Estatuto do Desarmamento',
    nomeCurto: 'Lei 10.826/03 (Desarmamento)',
    ano: 2003,
    disciplina: 'Legislação Penal Especial',
    descricao: 'Registro, posse e comercialização de armas de fogo e munição; Sinarm; crimes. Texto atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/leis/2003/l10.826.htm',
  },
  'lei-11340': {
    slug: 'lei-11340',
    nome: 'Lei nº 11.340, de 7 de agosto de 2006 — Lei Maria da Penha',
    nomeCurto: 'Lei 11.340/06 (Maria da Penha)',
    ano: 2006,
    disciplina: 'Legislação Penal Especial',
    descricao: 'Coíbe a violência doméstica e familiar contra a mulher; medidas protetivas de urgência. Texto atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11340.htm',
  },
  'lei-8072': {
    slug: 'lei-8072',
    nome: 'Lei nº 8.072, de 25 de julho de 1990 — Crimes Hediondos',
    nomeCurto: 'Lei 8.072/90 (Hediondos)',
    ano: 1990,
    disciplina: 'Legislação Penal Especial',
    descricao: 'Dispõe sobre os crimes hediondos e seu regime jurídico diferenciado. Texto atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8072.htm',
  },
  'lei-9455': {
    slug: 'lei-9455',
    nome: 'Lei nº 9.455, de 7 de abril de 1997 — Lei de Tortura',
    nomeCurto: 'Lei 9.455/97 (Tortura)',
    ano: 1997,
    disciplina: 'Legislação Penal Especial',
    descricao: 'Define os crimes de tortura. Texto atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l9455.htm',
  },
  'lei-12850': {
    slug: 'lei-12850',
    nome: 'Lei nº 12.850, de 2 de agosto de 2013 — Organizações Criminosas',
    nomeCurto: 'Lei 12.850/13 (ORCRIM)',
    ano: 2013,
    disciplina: 'Legislação Penal Especial',
    descricao: 'Define organização criminosa e disciplina a investigação, meios de obtenção de prova (colaboração premiada, infiltração). Texto atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12850.htm',
  },
  'lei-13869': {
    slug: 'lei-13869',
    nome: 'Lei nº 13.869, de 5 de setembro de 2019 — Lei de Abuso de Autoridade',
    nomeCurto: 'Lei 13.869/19 (Abuso)',
    ano: 2019,
    disciplina: 'Legislação Penal Especial',
    descricao: 'Define os crimes de abuso de autoridade cometidos por agente público. Texto atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/l13869.htm',
  },
  'lei-9613': {
    slug: 'lei-9613',
    nome: 'Lei nº 9.613, de 3 de março de 1998 — Lavagem de Dinheiro',
    nomeCurto: 'Lei 9.613/98 (Lavagem)',
    ano: 1998,
    disciplina: 'Legislação Penal Especial',
    descricao: 'Crimes de "lavagem" ou ocultação de bens, direitos e valores; COAF. Texto compilado e atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l9613compilado.htm',
  },
  'lei-7210': {
    slug: 'lei-7210',
    nome: 'Lei nº 7.210, de 11 de julho de 1984 — Lei de Execução Penal (LEP)',
    nomeCurto: 'LEP (Lei 7.210/84)',
    ano: 1984,
    disciplina: 'Legislação Penal Especial',
    descricao: 'Disciplina a execução da pena e da medida de segurança; progressão de regime, benefícios, disciplina. Texto compilado e atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l7210compilado.htm',
  },
  'lei-9099': {
    slug: 'lei-9099',
    nome: 'Lei nº 9.099, de 26 de setembro de 1995 — Juizados Especiais Cíveis e Criminais',
    nomeCurto: 'Lei 9.099/95 (JECrim)',
    ano: 1995,
    disciplina: 'Legislação Penal Especial',
    descricao: 'Juizados Especiais Cíveis e Criminais; infrações de menor potencial ofensivo, transação penal e suspensão condicional do processo. Texto atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l9099.htm',
  },
  'lei-9296': {
    slug: 'lei-9296',
    nome: 'Lei nº 9.296, de 24 de julho de 1996 — Interceptação Telefônica',
    nomeCurto: 'Lei 9.296/96 (Interceptação)',
    ano: 1996,
    disciplina: 'Legislação Penal Especial',
    descricao: 'Regulamenta a interceptação de comunicações telefônicas e de sistemas de informática/telemática para prova em investigação criminal. Texto atualizado (fonte: Planalto).',
    fonteUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l9296.htm',
  },
};

// ─── Entrada ─────────────────────────────────────────────────────────────────

const slug = process.argv[2];
const meta = LEIS[slug];
if (!meta) {
  console.error(`Lei desconhecida: "${slug}". Opções: ${Object.keys(LEIS).join(', ')}`);
  process.exit(1);
}
const fromIdx = process.argv.indexOf('--from');
const localFile = fromIdx > -1 ? process.argv[fromIdx + 1] : null;

// ─── Utilitários de texto ────────────────────────────────────────────────────

const BR_MARK = '\u0001'; // marcador de <br> ("TÍTULO I<br>DO NOME")

const ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  sect: '§', ordm: 'º', ordf: 'ª', deg: 'º', middot: '·', ndash: '–', mdash: '—',
};

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-zA-Z]+);/g, (_, name) => ENTITIES[name] ?? `&${name};`);
}

// Tags puramente cosméticas (fonte/tamanho/negrito) que o Planalto às vezes usa
// PARTEADAS no meio de um número de artigo ("Art. 21<font>7</font>." = 217) —
// removidas sem inserir espaço, ao contrário das demais tags (ver abaixo).
const INLINE_COSMETIC = /<\/?(?:font|b|i|em|u|sup|sub|small|big|strong)\b[^>]*>/gi;

function stripTags(s) {
  return s.replace(INLINE_COSMETIC, '').replace(/<[^>]*>/g, ' ');
}

function collapse(s) {
  return s.replace(/[\s ]+/g, ' ').replace(/ +([.,;:])/g, '$1').trim();
}

// Anotações de compilação que não são texto de lei. "(VETADO)" e "(Revogado...)"
// são preservados — carregam informação (o tratamento de revogado vem depois).
const ANOTACAO = /\s*\((?:Reda[çc][ãa]o dada|Reda[çc][ãa]o determinada|Inclu[íi]d[oa]s?|Acrescentad[oa]|Acrescid[oa]|Vide|Vig[êe]ncia|Renumerad[oa]|Restaurada|Regulamento|Reda[çc][ãa]o original|Alterad[oa]|Retifica[çc][ãa]o|Promulga[çc][ãa]o)[^()]*\)\s*/gi;

function limparAnotacoes(s) {
  let out = s;
  for (let i = 0; i < 4; i++) out = out.replace(ANOTACAO, ' '); // aninhadas/repetidas
  return collapse(out);
}

// Em compilados mais recentes (ex.: ECA), o Planalto marca dispositivo
// alterado/incluído com um link sobrescrito "Vigência" (SEM parênteses, ao
// contrário de "(Vigência)" tratado por ANOTACAO) que fica dentro do MESMO
// <p>/<br> do texto, não em um próprio — então sobra como token solto
// "Vigência" (sempre com V maiúsculo) colado ao HTML depois do stripTags,
// seja no final de uma frase ("...comprovado: Vigência") seja como um
// fragmento isolado entre pedaços de um heading partido por <br>
// ("Seção VIII" + "Vigência" + "Da Habilitação..."). Removido por palavra
// inteira com V maiúsculo para não afetar "vigência" (minúsculo) usado como
// palavra comum no meio de frases (ex.: "prova de vigência").
function limparVigenciaResidual(s) {
  return collapse(s.replace(/\bVig[êe]ncia\b/g, ' '));
}

// ─── Parser ──────────────────────────────────────────────────────────────────

const HEADING_LEVELS = ['PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO'];

function headingLevel(text) {
  const norm = text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
  for (let i = 0; i < HEADING_LEVELS.length; i++) {
    if (norm.startsWith(HEADING_LEVELS[i])) return i;
  }
  return -1;
}

function parseLei(html) {
  // 1. Redações antigas ficam em <strike>/<del> — fora do texto vigente.
  //    Em compilados mais recentes, o Planalto às vezes marca o trecho revogado
  //    com <span style="text-decoration:line-through"> em vez de <strike>.
  let body = html.replace(/<(strike|del)\b[\s\S]*?<\/\1>/gi, ' ');
  // Quote-agnóstico: o Planalto ora usa aspas duplas, ora simples no style, e o
  // valor de font-family pode conter aspas duplas embutidas ("Arial") — casar só
  // por text-decoration:line-through no tag de abertura (que nunca contém '>'),
  // até o próximo </span> (spans riscados do Planalto não são aninhados).
  body = body.replace(/<span\b[^>]*text-decoration\s*:\s*line-through[^>]*>[\s\S]*?<\/span>/gi, ' ');

  // 2. Divide em parágrafos pela abertura de <p ...> ou <h1..h6 ...> —
  //    o CPM/CPPM usam <h1>/<h2> para PARTE/LIVRO/TÍTULO.
  const chunks = body.split(/<(?:p|h[1-6])\b/i).slice(1);

  const artigos = [];
  const path = new Array(HEADING_LEVELS.length).fill(null);
  let atual = null;           // artigo em construção
  let rubricaPendente = null; // rubrica lida antes do "Art. N"
  // Nível do último heading estrutural — o NOME dele pode vir no parágrafo
  // centrado seguinte ("TÍTULO I" e depois "DO PROCESSO EM GERAL").
  let lastHeadingLevel = null;
  const warnings = [];

  const pushArtigo = () => { if (atual) { artigos.push(atual); atual = null; } };

  for (const chunk of chunks) {
    // O split consome só o "<p" — o resto da tag (atributos + ">") abre o chunk.
    const gt = chunk.indexOf('>');
    const attrs = gt > -1 ? chunk.slice(0, gt) : '';
    const corpo = gt > -1 ? chunk.slice(gt + 1) : chunk;
    const centered = /align\s*=\s*"?center/i.test(attrs);
    const comQuebras = corpo.replace(/<br\s*\/?\s*>/gi, BR_MARK);
    let text = collapse(decodeEntities(stripTags(comQuebras)));
    if (!text) continue;

    // Fim do texto legal (assinatura/rodapé do Planalto). Em decretos-lei que
    // aprovam um anexo (ex.: CLT — 2 artigos de decreto + o texto anexo, que
    // reinicia a numeração em "Art. 1º"), esse aviso aparece cedo, no meio do
    // documento — só tratamos como fim de verdade depois de já termos um corpo
    // substancial de artigos (nenhuma lei do catálogo tem menos de ~20).
    if (/^Bras[íi]lia,\s*\d/.test(text.split(BR_MARK)[0]) || (artigos.length > 15 && /Este texto n[ãa]o substitui/i.test(text))) break;

    if (centered) {
      const parts = text.split(BR_MARK).map((p) => limparVigenciaResidual(collapse(p))).filter(Boolean);
      const joined = parts.length > 1 ? `${parts[0]} — ${parts.slice(1).join(' ')}` : (parts[0] ?? '');
      const lvl = headingLevel(joined);
      if (lvl >= 0) {
        // limparAnotacoes pode deixar um "—" órfão ("PARTE ESPECIAL — (Vide...)").
        path[lvl] = limparAnotacoes(joined).replace(/\s*[—–-]\s*$/, '');
        for (let i = lvl + 1; i < path.length; i++) path[i] = null;
        lastHeadingLevel = path[lvl].includes(' — ') ? null : lvl;
      } else if (lastHeadingLevel !== null) {
        // Nome do heading em parágrafo(s) próprio(s): "LIVRO I" + "DOS CRIMES
        // MILITARES" + "EM TEMPO DE PAZ" — o primeiro ganha " — ", os demais " ".
        const nome = limparAnotacoes(joined);
        if (nome) {
          const sep = path[lastHeadingLevel].includes(' — ') ? ' ' : ' — ';
          path[lastHeadingLevel] = `${path[lastHeadingLevel]}${sep}${nome}`;
        }
      }
      continue; // centrado nunca é corpo de artigo
    }
    lastHeadingLevel = null;

    text = limparVigenciaResidual(collapse(text.split(BR_MARK).join(' ')));

    // Novo artigo: "Art. 121." / "Art. 121-A" / "Art. 359-M-A" / "Art 1º".
    // Sufixo de letra: hífen COLADO ao número ("121-A") e sem letra minúscula
    // depois — "Art. 1º - Não há crime" tem espaço antes do hífen e não é sufixo.
    const mArt = text.match(/^Art\.?\s*(\d+(?:\.\d{3})*)\s*[ºo°]?((?:-[A-Z]{1,2}(?![a-zA-Zà-öø-ÿ]))*)\s*[.:–-]?\s*/);
    if (mArt) {
      pushArtigo();
      const num = mArt[1].replace(/\./g, '');
      const letras = (mArt[2] || '').replace(/\s+/g, ''); // "-M-A"
      const numero = `${num}${letras}`;
      const n = Number(num);
      const rotulo = `Art. ${numero}${!letras && n < 10 ? 'º' : ''}`;
      // Aspas de citação da lei alteradora ("...multa.”") não são texto de lei.
      const resto = limparAnotacoes(text.slice(mArt[0].length)).replace(/\s*[”“"]\s*$/, '');
      const revogado = /^\(?\s*Revogad/i.test(resto);
      atual = {
        key: `${meta.slug}:${numero}`,
        ordem: artigos.length + 1,
        numero,
        rotulo,
        caminho: path.filter(Boolean).join(' › ') || null,
        incidencia: 'media',
        incidenciaNota: null,
        revogado,
        blocos: [],
        _b: 0,
      };
      if (rubricaPendente && !revogado) {
        atual.blocos.push({ id: `b${++atual._b}`, rotulo: null, texto: rubricaPendente, nivel: 0 });
      }
      rubricaPendente = null;
      atual.blocos.push({
        id: `b${++atual._b}`,
        rotulo: null,
        texto: revogado ? '(Revogado)' : (resto || '(sem caput)'),
        nivel: 0,
      });
      if (!revogado && !resto) warnings.push(`caput vazio em ${rotulo}`);
      continue;
    }

    const texto = limparAnotacoes(text).replace(/\s*[”“"]\s*$/, '');
    if (!texto) continue;
    // Restos de anotação sem parênteses ("Vigência", "Texto compilado").
    if (/^\(?\s*(Vig[êe]ncia|Texto compilado|Mensagem de veto)\s*\)?$/i.test(texto)) continue;

    // Blocos do artigo corrente.
    if (atual) {
      if (atual.revogado) continue; // revogado não acumula corpo

      const mPar = texto.match(/^§\s*(\d+)\s*[ºo°]?\s*[.:–-]?\s*/);
      const mPU = texto.match(/^Par[áa]grafo [úu]nico\s*[.:–-]?\s*/i);
      const mInc = texto.match(/^([IVXLCDM]{1,8})\s*[-–—.]\s+/);
      const mAli = texto.match(/^([a-z])\s*\)\s+/);

      if (mPar) {
        const corpo = collapse(texto.slice(mPar[0].length));
        atual.blocos.push({ id: `b${++atual._b}`, rotulo: `§ ${mPar[1]}º`, texto: revogadoOuTexto(corpo), nivel: 1 });
      } else if (mPU) {
        const corpo = collapse(texto.slice(mPU[0].length));
        atual.blocos.push({ id: `b${++atual._b}`, rotulo: 'Parágrafo único.', texto: revogadoOuTexto(corpo), nivel: 1 });
      } else if (mInc) {
        const corpo = collapse(texto.slice(mInc[0].length));
        atual.blocos.push({ id: `b${++atual._b}`, rotulo: `${mInc[1]} –`, texto: revogadoOuTexto(corpo), nivel: 1 });
      } else if (mAli) {
        const corpo = collapse(texto.slice(mAli[0].length));
        atual.blocos.push({ id: `b${++atual._b}`, rotulo: `${mAli[1]})`, texto: revogadoOuTexto(corpo), nivel: 2 });
      } else {
        // Continuação ("Pena - ...") ou rubrica interna ("Homicídio qualificado").
        atual.blocos.push({ id: `b${++atual._b}`, rotulo: null, texto, nivel: 0 });
      }
      continue;
    }

    // Antes do primeiro artigo (ementa/preâmbulo) ou rubrica antes do "Art.".
    if (ehRubrica(texto)) rubricaPendente = texto;
  }
  pushArtigo();

  for (const a of artigos) delete a._b;
  return { artigos, warnings };
}

function revogadoOuTexto(corpo) {
  return /^\(?\s*Revogad/i.test(corpo) || corpo === '' ? '(Revogado)' : corpo;
}

// Rubrica (nomen juris): linha curta, sem pontuação final de frase, que não é
// pena/preceito ("Pena - ...") nem começo de dispositivo.
function ehRubrica(texto) {
  if (texto.length > 90) return false;
  if (/[.;:]$/.test(texto)) return false;
  if (/^(Pena|Par[áa]grafo|§|Art\b)/i.test(texto)) return false;
  return /^[A-ZÀ-Ú]/.test(texto);
}

// ─── Main ────────────────────────────────────────────────────────────────────

// A maioria das páginas do Planalto é windows-1252, mas algumas (ex.: Lei Maria
// da Penha, l11340) vêm em UTF-16 — decodificar como 1252 intercala um byte
// nulo em cada caractere e o parser não acha nenhum "Art.". Detecta pelo BOM
// (FF FE / FE FF) ou pela presença massiva de bytes nulos no início do buffer.
function decodeHtml(buf) {
  const bytes = new Uint8Array(buf);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(buf);
  const amostra = bytes.subarray(0, 2000);
  let nulos = 0;
  for (const b of amostra) if (b === 0) nulos++;
  if (nulos > amostra.length / 4) {
    // UTF-16 sem BOM: bytes pares nulos → LE, ímpares nulos → BE.
    let nulosPares = 0;
    for (let i = 1; i < amostra.length; i += 2) if (amostra[i] === 0) nulosPares++;
    return new TextDecoder(nulosPares > amostra.length / 8 ? 'utf-16le' : 'utf-16be').decode(buf);
  }
  return normalizarC1(new TextDecoder('windows-1252').decode(buf));
}

// Algumas páginas do Planalto (ex.: l8072, l9455, l9613, l7210) trazem a
// pontuação "inteligente" do intervalo 0x91-0x97 do Windows-1252 num
// mapeamento que sobra como caractere de controle C1 (U+0091-U+0097) em vez do
// sinal gráfico — o pior é o U+0096 ("–") que fica invisível e some do rótulo
// do inciso ("II – texto" vira "II texto"). Mapeia cada um para o sinal correto.
const C1_PUNTUACAO = {
  0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”",
  0x95: "•", 0x96: "–", 0x97: "—", 0x85: "…",
};
function normalizarC1(s) {
  return s.replace(/[-]/g, (c) => C1_PUNTUACAO[c.charCodeAt(0)] ?? " ");
}

async function main() {
  let html;
  if (localFile) {
    html = decodeHtml(readFileSync(resolve(localFile)));
  } else {
    console.log(`Baixando ${meta.fonteUrl} …`);
    const res = await fetch(meta.fonteUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar o compilado.`);
    html = decodeHtml(await res.arrayBuffer());
  }

  // Documentos mais antigos (ex.: CLT) às vezes grafam o sufixo de letra COLADO
  // ao número sem hífen ("Art. 401A." em vez de "Art. 401-A.") — insere o hífen
  // antes de parsear para cair no mesmo caminho de "121-A". Padrão raro o
  // bastante (letras maiúsculas coladas direto num ponto, sem espaço, logo após
  // dígitos de "Art.") para não gerar falso positivo em texto corrido normal.
  html = html.replace(/(Art\.?\s*\d+)([A-Z]{1,2})(\.)/g, '$1-$2$3');

  const { artigos, warnings } = parseLei(html);
  if (artigos.length === 0) throw new Error('Nenhum artigo extraído — o layout do Planalto mudou?');

  const out = {
    slug: meta.slug,
    nome: meta.nome,
    nomeCurto: meta.nomeCurto,
    ano: meta.ano,
    disciplina: meta.disciplina,
    descricao: meta.descricao,
    fonteUrl: meta.fonteUrl,
    geradoEm: new Date().toISOString().slice(0, 10),
    artigos,
  };

  const dest = resolve(import.meta.dirname, '..', 'public', 'leis', `${meta.slug}.json`);
  writeFileSync(dest, JSON.stringify(out, null, 1), 'utf8');

  const revogados = artigos.filter((a) => a.revogado).length;
  console.log(`OK ${dest}`);
  console.log(`  ${artigos.length} artigos (${revogados} revogados) · último: ${artigos[artigos.length - 1].rotulo}`);
  console.log(`  totalArtigos para o LEIS_CATALOG: ${artigos.length}`);
  if (warnings.length) console.log(`  avisos:\n   - ${warnings.slice(0, 12).join('\n   - ')}${warnings.length > 12 ? `\n   ... +${warnings.length - 12}` : ''}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
