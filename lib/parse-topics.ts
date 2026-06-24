// lib/parse-topics.ts
// Transforma um bloco de texto colado numa lista limpa de nomes de tópicos.
// Cada linha vira um tópico. Remove numeração e marcadores comuns de editais.

export function parseTopics(raw: string): string[] {
  return raw
    .split('\n')
    .map((linha) => limparLinha(linha))
    .filter((linha) => linha.length > 0)
    .filter((linha, i, arr) => arr.indexOf(linha) === i); // remove duplicatas
}

function limparLinha(linha: string): string {
  let s = linha.trim();
  // Remove marcadores de lista no início: "1.", "1.1", "1.1.1", "a)", "-", "•", "–", "*"
  s = s.replace(/^[\s]*[-–•*]\s+/, '');               // bullets
  s = s.replace(/^[\s]*\d+(\.\d+)*[.)]\s*/, '');        // 1.  1.1  1)  2.3.
  s = s.replace(/^[\s]*[a-zA-Z][.)]\s+/, '');           // a)  b.  (mas não "Direito A.")
  // Remove ponto-e-vírgula ou ponto final solto no fim (comum em editais)
  s = s.replace(/[;.]\s*$/, '');
  return s.trim();
}