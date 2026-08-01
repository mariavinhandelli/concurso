// supabase/functions/mirror-edital-pdfs/index.ts
// Guarda uma cópia própria do PDF de cada edital OFICIAL, com proveniência.
//
// Por quê: enquanto o botão "Baixar edital (PDF)" aponta direto para o servidor
// do órgão/banca, ele quebra quando aquele servidor reorganiza o site, tira o
// arquivo do ar ou passa a bloquear bot — e edital fora do ar é perda de
// conteúdo insubstituível para quem estuda. Este projeto já levou 403 do
// Qconcursos por isso (migration 20260715170000).
//
// Base legal: edital de concurso é ato oficial, sem proteção autoral
// (Lei 9.610/98, art. 8º, IV). Espelhar é lícito.
//
// ESCOPO ESTRITO (autorizado explicitamente): só o PDF do EDITAL, e só quando
// a URL é de domínio OFICIAL (órgão ou banca) — a mesma allowlist que o banco
// já impõe em editais_catalog.edital_url. Prova/gabarito hospedados por
// terceiro NÃO entram: a cópia que temos deles não é da fonte primária.
//
// Idempotente: se o sha256 do arquivo remoto é igual ao já espelhado, não
// regrava — só atualiza last_checked_at. Assim pode rodar quantas vezes quiser.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const BUCKET = 'editais-oficiais';
const MAX_BYTES = 25 * 1024 * 1024; // teto do bucket; edital gordo tem ~5 MB

// Espelho da allowlist do CHECK editais_catalog_edital_url_official_ck. Está
// duplicada de propósito: o banco protege o campo, esta função protege o
// download. Nenhuma das duas deve confiar na outra.
function isOfficialUrl(url: string): boolean {
  return /^https:\/\/([a-z0-9-]+\.)*(gov\.br|jus\.br|leg\.br|tc\.br|fgv\.br|fcc\.org\.br|institutoaocp\.org\.br|aocp\.com\.br|cebraspe\.org\.br|vunesp\.com\.br|fundatec\.org\.br|ibfc\.org\.br|iades\.com\.br|fepese\.org\.br|fumarc\.com\.br|idecan\.org\.br|quadrix\.org\.br|ibade\.org\.br)(\/.*)?$/i
    .test(url);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface Row {
  id: string;
  slug: string;
  edital_url: string;
}

type Resultado = { slug: string; status: string; tipo: 'novo' | 'inalterado' | 'atualizado' | 'falhou' };

async function espelhar(row: Row, jaTem: Map<string, { sha256: string; storage_path: string }>): Promise<Resultado> {
  const url = row.edital_url;
  // Cinto de segurança: mesmo que o banco deixasse passar, aqui não baixa.
  if (!isOfficialUrl(url)) {
    return { slug: row.slug, status: `recusado: domínio não oficial (${url})`, tipo: 'falhou' };
  }
  if (!/\.pdf($|\?)/i.test(url)) {
    return { slug: row.slug, status: 'pulado: URL não é PDF (é página institucional)', tipo: 'falhou' };
  }

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FocaliBot/1.0; +mailto:mariavinhandelli@gmail.com)' },
    });
  } catch (e) {
    return { slug: row.slug, status: `fetch falhou: ${e instanceof Error ? e.message : String(e)}`, tipo: 'falhou' };
  }
  if (!res.ok) return { slug: row.slug, status: `fetch falhou: HTTP ${res.status}`, tipo: 'falhou' };

  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    return { slug: row.slug, status: `recusado: ${buf.byteLength} bytes acima do teto`, tipo: 'falhou' };
  }
  // Assinatura real do arquivo, não o content-type declarado: página de erro
  // servida com 200 e content-type de PDF é um jeito clássico de gravar lixo.
  const magic = new TextDecoder('ascii').decode(buf.subarray(0, 5));
  if (magic !== '%PDF-') {
    return { slug: row.slug, status: `recusado: não é PDF (assinatura "${magic}")`, tipo: 'falhou' };
  }

  const sha = await sha256Hex(buf);
  const anterior = jaTem.get(row.id);
  const now = new Date().toISOString();

  if (anterior && anterior.sha256 === sha) {
    await supabase.from('edital_pdf_mirrors').update({ last_checked_at: now }).eq('edital_catalog_id', row.id);
    return { slug: row.slug, status: `inalterado (${buf.byteLength} bytes)`, tipo: 'inalterado' };
  }

  // Caminho inclui o hash: uma revisão nova do edital nunca sobrescreve a
  // anterior, e o cache do CDN não serve conteúdo velho por URL igual.
  const path = `${row.slug}/${sha.slice(0, 12)}.pdf`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (upErr) return { slug: row.slug, status: `upload falhou: ${upErr.message}`, tipo: 'falhou' };

  const { error: dbErr } = await supabase.from('edital_pdf_mirrors').upsert({
    edital_catalog_id: row.id,
    source_url: url,
    storage_path: path,
    sha256: sha,
    bytes: buf.byteLength,
    captured_at: now,
    last_checked_at: now,
  });
  if (dbErr) return { slug: row.slug, status: `registro falhou: ${dbErr.message}`, tipo: 'falhou' };

  return {
    slug: row.slug,
    status: `${anterior ? 'atualizado' : 'espelhado'}: ${buf.byteLength} bytes → ${path}`,
    tipo: anterior ? 'atualizado' : 'novo',
  };
}

// Teto por execução. O loop é sequencial (servidor de órgão não gosta de
// rajada) e cada download pode levar segundos; sem teto, um catálogo grande
// estoura o wall-clock da Edge Function e a invocação inteira se perde — os
// editais do fim da lista nunca seriam espelhados. Com o teto + ordenação por
// last_checked_at, cada execução pega os mais desatualizados e o cron semanal
// cobre o catálogo em poucas rodadas.
const BATCH = 8;

Deno.serve(async () => {
  const { data: mirrors } = await supabase
    .from('edital_pdf_mirrors')
    .select('edital_catalog_id, sha256, storage_path, last_checked_at');
  const jaTem = new Map((mirrors ?? []).map((m) => [m.edital_catalog_id, { sha256: m.sha256, storage_path: m.storage_path }]));
  const checadoEm = new Map((mirrors ?? []).map((m) => [m.edital_catalog_id, m.last_checked_at as string | null]));

  const { data: editais, error } = await supabase
    .from('editais_catalog')
    .select('id, slug, edital_url')
    .eq('is_active', true)
    .not('edital_url', 'is', null);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Só entra na fila quem TEM PDF. Sem este filtro, os editais cuja URL é
  // página institucional (a maioria hoje) nunca ganham last_checked_at, ficam
  // eternamente no topo da ordenação e consomem o lote inteiro em "pulado" —
  // os PDFs de verdade nunca seriam reconferidos por retificação.
  const mirroraveis = ((editais ?? []) as Row[]).filter((r) => /\.pdf($|\?)/i.test(r.edital_url));

  // Nunca espelhado primeiro; depois o checado há mais tempo.
  const fila = mirroraveis
    .sort((a, b) => {
      const ca = checadoEm.get(a.id) ?? '';
      const cb = checadoEm.get(b.id) ?? '';
      return ca.localeCompare(cb);
    })
    .slice(0, BATCH);

  const results: Record<string, string> = {};
  let novos = 0, inalterados = 0, atualizados = 0, falhas = 0;

  for (const row of fila) {
    const r = await espelhar(row, jaTem);
    results[r.slug] = r.status;
    if (r.tipo === 'novo') novos++;
    else if (r.tipo === 'atualizado') atualizados++;
    else if (r.tipo === 'inalterado') inalterados++;
    else falhas++;
  }

  return new Response(JSON.stringify({
    novos, atualizados, inalterados, falhas,
    comPdf: mirroraveis.length, processados: fila.length,
    semPdf: (editais ?? []).length - mirroraveis.length, results,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
