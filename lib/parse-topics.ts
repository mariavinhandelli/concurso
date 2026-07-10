// lib/parse-topics.ts
// Transforma um bloco de texto colado numa lista limpa de nomes de tópicos.
// Cada linha vira um tópico. Remove numeração e marcadores comuns de editais.

export interface ParsedTopic {
  name: string;
  child: boolean; // subitem do último tópico de nível superior (vira subtópico)
}

export function parseTopics(raw: string): string[] {
  return parseTopicsTree(raw).map((t) => t.name);
}

// Versão com hierarquia: "a)", "i.", "1.1" e linhas indentadas viram subtópicos
// do último item de nível superior — o recorte que editais reais usam.
export function parseTopicsTree(raw: string): ParsedTopic[] {
  const seen = new Set<string>();
  const result: ParsedTopic[] = [];
  let temPai = false;
  for (const linha of raw.split('\n')) {
    const limpa = limparLinha(linha);
    if (limpa.length === 0 || seen.has(limpa)) continue;
    seen.add(limpa);
    // Subitem sem pai anterior é promovido a nível superior.
    const child = ehSubitem(linha) && temPai;
    if (!child) temPai = true;
    result.push({ name: limpa, child });
  }
  return result;
}

// Heurística de subitem, avaliada ANTES da limpeza (o marcador é o sinal):
// letra ("a)", "b."), romano minúsculo ("i.", "iv)"), numeração composta
// ("1.1", "2.3.") ou indentação de 2+ espaços/tab. Segmentos de numeração são
// limitados a 1-2 dígitos para não confundir com números de lei ("14.133").
function ehSubitem(linha: string): boolean {
  if (/^(\s{2,}|\t)/.test(linha)) return true;
  const s = linha.trim();
  if (/^[a-z][.)]\s/.test(s)) return true;                       // a)  b.
  if (/^(x{0,1}(ix|iv|v?i{1,3}|v|x))[.)]\s/.test(s)) return true; // i.  iv)  x.
  if (/^\d{1,2}(\.\d{1,2})+[.)]?\s/.test(s)) return true;         // 1.1  2.3.4.
  return false;
}

// Exposto para o parser de edital reaproveitar a mesma limpeza de linha.
export function cleanTopicLine(linha: string): string {
  return limparLinha(linha);
}

function limparLinha(linha: string): string {
  let s = linha.trim();
  // Remove marcadores de lista no início: "1.", "1.1", "1.1.1", "a)", "-", "•", "–", "*"
  s = s.replace(/^[\s]*[-–•*]\s+/, '');               // bullets
  // Numeração composta ("2.1", "2.3.4.") ANTES da regra genérica — senão o
  // backtracking dela come só o "2." e sobra "1 Iniciativa". Segmentos de
  // 1-2 dígitos para não comer números de lei ("14.133 e alterações").
  s = s.replace(/^[\s]*\d{1,2}(\.\d{1,2})+[.)]?\s+/, '');
  s = s.replace(/^[\s]*\d+(\.\d+)*[.)]\s*/, '');        // 1.  1.1.  1)  2.3.
  s = s.replace(/^[\s]*[a-zA-Z][.)]\s+/, '');           // a)  b.  (mas não "Direito A.")
  // Remove ponto-e-vírgula ou ponto final solto no fim (comum em editais)
  s = s.replace(/[;.]\s*$/, '');
  return s.trim();
}