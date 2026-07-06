// lib/parse-edital.ts
// Parser do texto colado de um edital (fallback manual do Banco de Editais).
// Agrupa em disciplinas + tópicos: linhas "cabeçalho" (caixa alta ou palavra-chave)
// abrem uma nova disciplina; as demais viram tópicos da disciplina atual.

import { cleanTopicLine } from '@/lib/parse-topics';

export interface EditalGroup {
  subject: string;
  topics: string[];
}

const KW_HEADER = /^(disciplina|mat[eé]ria|conhecimentos|no[cç][oõ]es|l[ií]ngua)\b/i;

// Fração de letras maiúsculas (considera acentuadas). Cabeçalhos de edital costumam
// vir em CAIXA ALTA ("DIREITO CONSTITUCIONAL").
function fracaoMaiuscula(s: string): number {
  const letras = [...s].filter((c) => c.toLowerCase() !== c.toUpperCase());
  if (letras.length === 0) return 0;
  const maiusc = letras.filter((c) => c === c.toUpperCase()).length;
  return maiusc / letras.length;
}

function ehCabecalho(linha: string): boolean {
  const letras = linha.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letras.length < 3) return false;               // "1." "a)" não são disciplina
  if (KW_HEADER.test(linha.trim())) return true;
  return fracaoMaiuscula(linha) >= 0.7 && linha.trim().length <= 60;
}

function limparCabecalho(linha: string): string {
  return linha
    .replace(/^[\s]*\d+(\.\d+)*[.)\-–]?\s*/, '')  // "1. ", "1 - " no início
    .replace(/[:.\-–]\s*$/, '')                    // ":" "." "-" no fim
    .trim();
}

export function parseEdital(raw: string): EditalGroup[] {
  const groups: EditalGroup[] = [];
  let atual: EditalGroup | null = null;

  const addTopico = (t: string) => {
    if (!atual) { atual = { subject: 'Conteúdo do edital', topics: [] }; groups.push(atual); }
    if (!atual.topics.includes(t)) atual.topics.push(t);
  };

  for (const linhaRaw of raw.split('\n')) {
    const linha = linhaRaw.trim();
    if (!linha) continue;

    if (ehCabecalho(linha)) {
      const nome = limparCabecalho(linha);
      if (nome.length >= 2) { atual = { subject: nome, topics: [] }; groups.push(atual); }
    } else {
      const t = cleanTopicLine(linha);
      if (t) addTopico(t);
    }
  }

  return groups.filter((g) => g.topics.length > 0);
}
