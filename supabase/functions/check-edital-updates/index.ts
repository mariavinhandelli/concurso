// supabase/functions/check-edital-updates/index.ts
// Monitor de fontes oficiais de concurso. Busca a página de concursos de cada
// órgão/banca acompanhada, compara com o hash da última verificação e, se
// mudou, grava um alerta com trecho do diff e avisa a curadora por push.
//
// Por que existe: a 2ª auditoria de Concursos (28/07) achou o módulo prometendo
// "Acompanhar novidades" enquanto a última notícia curada era de 09/06 — a
// infra de push (notify-edital-updates) funcionava, mas ninguém percebia que a
// fonte tinha mudado. Este job é o gatilho que faltava.
//
// NÃO cria edital_updates nem mexe no catálogo. Publicar notícia de concurso a
// partir de um diff de HTML sem leitura humana geraria conteúdo errado com cara
// de curadoria — mesma regra do check-lei-updates. Aqui só detecta e avisa; a
// notícia real entra numa sessão de curadoria, com fonte conferida.
//
// Sem custo de LLM — fetch + hash + diff. Segredo: VAPID_PRIVATE_KEY.

import webpush from 'npm:web-push@3.6.7';
import { diffLines } from 'npm:diff@5.2.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const VAPID_PUBLIC = 'BBgjY2251ulxouwlZRKBWC4cMXfWWU4gyUpwHEnBcZxQrl8S0nTdjIvvYZ-KKJ7QCWXGEpIwWM6krSHew1mIKHE';
const VAPID_SUBJECT = 'mailto:mariavinhandelli@gmail.com';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';

// Só a curadora recebe: usuária comum não tem o que fazer com "a página do
// TCE-GO mudou" — ela quer a notícia já curada, que vem por notify-edital-updates.
const CURATOR_USER_ID = '4e714b43-fbd1-4fd6-82b8-168b11d9a5ce';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface Fonte {
  slug: string;
  label: string;
  source_url: string;
  source_hash: string | null;
}

function decodificar(buf: ArrayBuffer, contentType: string | null): string {
  const bytes = new Uint8Array(buf);
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(buf);
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(buf);
  const declarado = (contentType ?? '').toLowerCase();
  const charset = /utf-?8/.test(declarado) ? 'utf-8'
    : /8859-1|windows-1252/.test(declarado) ? 'windows-1252'
    : 'utf-8';
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
}

async function buscarComRetry(url: string): Promise<Response> {
  const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; FocaliBot/1.0; +mailto:mariavinhandelli@gmail.com)' };
  try {
    const res = await fetch(url, { headers });
    if (res.ok) return res;
    await new Promise((r) => setTimeout(r, 1500));
    return await fetch(url, { headers });
  } catch {
    await new Promise((r) => setTimeout(r, 1500));
    return await fetch(url, { headers });
  }
}

// Portais de órgão têm muito cromo dinâmico (menu, banner rotativo, data de
// "última atualização") que muda sozinho e produziria alerta falso toda semana.
// Tira o que é notoriamente volátil antes do hash.
function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&aacute;/gi, 'á').replace(/&eacute;/gi, 'é').replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó').replace(/&uacute;/gi, 'ú').replace(/&atilde;/gi, 'ã')
    .replace(/&otilde;/gi, 'õ').replace(/&ccedil;/gi, 'ç').replace(/&ordm;/gi, 'º')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#\d+;/g, ' ')
    // Data/hora de "última atualização" muda a cada requisição em alguns
    // portais e não significa novidade de concurso.
    .replace(/\d{2}\/\d{2}\/\d{4},?\s*\d{2}:\d{2}(:\d{2})?/g, ' ')
    // Invisíveis (NUL, zero-width, BOM): mudam o hash sem mudar o conteúdo, e
    // o NUL ainda é recusado por coluna text do Postgres.
    .replace(/[\u0000\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function buildDiffSnippet(oldText: string, newText: string): string {
  const toLines = (t: string) => t.replace(/\. /g, '.\n');
  const parts = diffLines(toLines(oldText), toLines(newText));
  const changed = parts.filter((p) => p.added || p.removed);
  const snippet = changed
    .slice(0, 6)
    .map((p) => `${p.added ? '+ ' : '- '}${p.value.trim().slice(0, 200)}`)
    .join('\n');
  return snippet.slice(0, 1200) || '(mudança detectada, mas sem trecho legível — confira a fonte)';
}

type Resultado = { slug: string; status: string; tipo: 'ok' | 'changed' | 'failed' };

async function verificarFonte(fonte: Fonte): Promise<Resultado> {
  try {
    const res = await buscarComRetry(fonte.source_url);
    if (!res.ok) {
      return { slug: fonte.slug, status: `fetch falhou: HTTP ${res.status}`, tipo: 'failed' };
    }
    const html = decodificar(await res.arrayBuffer(), res.headers.get('content-type'));
    const text = htmlToPlainText(html);
    // Página de concursos real sempre tem algum conteúdo; texto minúsculo é
    // bloqueio ou erro disfarçado e não pode virar "mudança".
    if (text.length < 300) {
      return { slug: fonte.slug, status: 'texto extraído suspeito (muito curto) — pulado', tipo: 'failed' };
    }
    const hash = await sha256Hex(text);
    const now = new Date().toISOString();

    if (!fonte.source_hash) {
      await supabase.from('edital_source_checks').update({
        source_hash: hash, source_text: text, last_checked_at: now,
      }).eq('slug', fonte.slug);
      return { slug: fonte.slug, status: 'linha de base estabelecida (primeira verificação)', tipo: 'ok' };
    }

    if (fonte.source_hash === hash) {
      await supabase.from('edital_source_checks').update({ last_checked_at: now }).eq('slug', fonte.slug);
      return { slug: fonte.slug, status: 'sem mudança', tipo: 'ok' };
    }

    const { data: anterior } = await supabase
      .from('edital_source_checks').select('source_text').eq('slug', fonte.slug).maybeSingle();
    const snippet = buildDiffSnippet(anterior?.source_text ?? '', text);
    await supabase.from('edital_source_checks').update({
      source_hash: hash, source_text: text, last_checked_at: now,
      last_changed_at: now, diff_snippet: snippet,
    }).eq('slug', fonte.slug);

    if (VAPID_PRIVATE) {
      try {
        webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
        const { data: subs } = await supabase
          .from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', CURATOR_USER_ID);
        const payload = JSON.stringify({
          title: `Fonte de concurso mudou — ${fonte.label}`,
          body: snippet.slice(0, 150),
          url: fonte.source_url,
          tag: `focali-edital-source-${fonte.slug}`,
        });
        for (const sub of subs ?? []) {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        }
        await supabase.from('edital_source_checks').update({ last_alert_sent_at: now }).eq('slug', fonte.slug);
      } catch (e) {
        console.error(`Push falhou para ${fonte.slug}:`, e);
        // Não é fatal: o alerta já está em edital_source_checks.
      }
    }
    return { slug: fonte.slug, status: 'MUDANÇA DETECTADA', tipo: 'changed' };
  } catch (e) {
    console.error(`Erro verificando ${fonte.slug}:`, e);
    return { slug: fonte.slug, status: `exceção: ${e instanceof Error ? e.message : String(e)}`, tipo: 'failed' };
  }
}

Deno.serve(async () => {
  // São poucas fontes (4) e páginas de listagem são leves — cabem todas numa
  // execução, diferente das 37 leis. Se a lista crescer, fatiar como lá.
  const { data: fontes, error } = await supabase
    .from('edital_source_checks')
    .select('slug, label, source_url, source_hash')
    .order('last_checked_at', { ascending: true, nullsFirst: true });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const results: Record<string, string> = {};
  let checked = 0, changed = 0, failed = 0;

  const LOTE = 2; // portais de órgão são sensíveis a rajada
  const fila = (fontes ?? []) as Fonte[];
  for (let i = 0; i < fila.length; i += LOTE) {
    const lote = await Promise.all(fila.slice(i, i + LOTE).map(verificarFonte));
    for (const r of lote) {
      results[r.slug] = r.status;
      if (r.tipo === 'changed') { changed++; checked++; }
      else if (r.tipo === 'ok') checked++;
      else failed++;
    }
  }

  return new Response(JSON.stringify({ fontes: fila.length, checked, changed, failed, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
