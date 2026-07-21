// supabase/functions/check-lei-updates/index.ts
// Check semanal de atualização de legislação. Roda via pg_cron toda
// segunda-feira. Busca o texto da fonte oficial (Planalto / Casa Civil GO) de
// cada uma das 11 leis do Vade Mecum, compara com o hash salvo na última
// verificação e, se mudou, grava um alerta com um trecho do diff e tenta
// avisar a Maria por push (best-effort — funciona mesmo sem subscription
// ativa, já que o alerta fica sempre gravado em lei_source_checks).
//
// NÃO aplica nenhuma mudança sozinho. O texto das leis vive em arquivos
// estáticos (public/leis/*.json), fora do banco — mesmo que quisesse, este
// processo não tem como reescrever esses arquivos. E não deveria: reescrever
// lei sem supervisão é exatamente o tipo de erro de alto risco que este
// projeto decidiu evitar. Este job só detecta e avisa; a atualização real
// exige uma sessão de código pra regenerar o JSON e redeployar.
//
// Sem custo de LLM — é só fetch + hash + diff de texto.
// Segredo necessário: VAPID_PRIVATE_KEY (já configurado, mesmo do push diário).

import webpush from 'npm:web-push@3.6.7';
import { diffLines } from 'npm:diff@5.2.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const VAPID_PUBLIC = 'BBgjY2251ulxouwlZRKBWC4cMXfWWU4gyUpwHEnBcZxQrl8S0nTdjIvvYZ-KKJ7QCWXGEpIwWM6krSHew1mIKHE';
const VAPID_SUBJECT = 'mailto:mariavinhandelli@gmail.com';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';

// Destinatária dos alertas — só a Maria (curadora de conteúdo), nunca as
// usuárias em geral: elas não têm como agir numa mudança de lei.
const CURATOR_USER_ID = '4e714b43-fbd1-4fd6-82b8-168b11d9a5ce';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Metadados mínimos — só o suficiente pra buscar e identificar a fonte.
// O texto completo das leis (public/leis/*.json) não é lido aqui.
const LEIS: { slug: string; nome: string; url: string }[] = [
  { slug: 'cf-88', nome: 'Constituição Federal', url: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm' },
  { slug: 'cp', nome: 'Código Penal', url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm' },
  { slug: 'cpp', nome: 'Código de Processo Penal', url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689compilado.htm' },
  { slug: 'cpm', nome: 'Código Penal Militar', url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del1001compilado.htm' },
  { slug: 'cppm', nome: 'Código de Processo Penal Militar', url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del1002compilado.htm' },
  { slug: 'go-13800', nome: 'Lei Estadual GO 13.800/2001', url: 'https://legisla.casacivil.go.gov.br/pesquisa_legislacao/81441/lei-13800' },
  { slug: 'lei-12527', nome: 'Lei de Acesso à Informação', url: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm' },
  { slug: 'lei-14133', nome: 'Nova Lei de Licitações', url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm' },
  { slug: 'lei-8429', nome: 'Lei de Improbidade Administrativa', url: 'https://www.planalto.gov.br/ccivil_03/leis/l8429.htm' },
  { slug: 'lei-9784', nome: 'Lei do Processo Administrativo Federal', url: 'https://www.planalto.gov.br/ccivil_03/leis/l9784.htm' },
  { slug: 'lgpd', nome: 'LGPD', url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm' },
];

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&aacute;/gi, 'á').replace(/&eacute;/gi, 'é').replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó').replace(/&uacute;/gi, 'ú').replace(/&atilde;/gi, 'ã')
    .replace(/&otilde;/gi, 'õ').replace(/&ccedil;/gi, 'ç').replace(/&ordm;/gi, 'º')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function buildDiffSnippet(oldText: string, newText: string): string {
  // diffLines trabalha melhor com quebras reais; reintroduz uma por frase
  // aproximada pra não comparar o texto inteiro como uma única "linha".
  const toLines = (t: string) => t.replace(/\. /g, '.\n');
  const parts = diffLines(toLines(oldText), toLines(newText));
  const changed = parts.filter((p) => p.added || p.removed);
  const snippet = changed
    .slice(0, 6)
    .map((p) => `${p.added ? '+ ' : '- '}${p.value.trim().slice(0, 200)}`)
    .join('\n');
  return snippet.slice(0, 1200) || '(mudança detectada, mas sem trecho legível — confira a fonte)';
}

Deno.serve(async () => {
  const results: Record<string, string> = {};
  let checked = 0, changed = 0, failed = 0;

  for (const lei of LEIS) {
    try {
      const res = await fetch(lei.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FocaliBot/1.0; +mailto:mariavinhandelli@gmail.com)' },
      });
      if (!res.ok) {
        results[lei.slug] = `fetch falhou: HTTP ${res.status}`;
        failed++;
        continue;
      }
      const html = await res.text();
      const text = htmlToPlainText(html);
      if (text.length < 500) {
        // Página vazia/bloqueada não deve virar "mudança" — texto real de lei
        // sempre tem milhares de caracteres.
        results[lei.slug] = 'texto extraído suspeito (muito curto) — pulado';
        failed++;
        continue;
      }
      const hash = await sha256Hex(text);

      const { data: prev } = await supabase
        .from('lei_source_checks')
        .select('source_hash, source_text')
        .eq('slug', lei.slug)
        .maybeSingle();

      const now = new Date().toISOString();

      if (!prev || !prev.source_hash) {
        // Primeira verificação desta lei: só estabelece a linha de base.
        await supabase.from('lei_source_checks').upsert({
          slug: lei.slug, source_url: lei.url, source_hash: hash, source_text: text,
          last_checked_at: now,
        });
        results[lei.slug] = 'linha de base estabelecida (primeira verificação)';
        checked++;
        continue;
      }

      if (prev.source_hash === hash) {
        await supabase.from('lei_source_checks').update({ last_checked_at: now }).eq('slug', lei.slug);
        results[lei.slug] = 'sem mudança';
        checked++;
        continue;
      }

      // Mudou: grava snapshot novo + diff, tenta avisar por push.
      const snippet = buildDiffSnippet(prev.source_text ?? '', text);
      await supabase.from('lei_source_checks').update({
        source_hash: hash, source_text: text, last_checked_at: now,
        last_changed_at: now, diff_snippet: snippet,
      }).eq('slug', lei.slug);
      changed++;
      results[lei.slug] = 'MUDANÇA DETECTADA';

      if (VAPID_PRIVATE) {
        try {
          webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
          const { data: subs } = await supabase
            .from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', CURATOR_USER_ID);
          const payload = JSON.stringify({
            title: `Possível mudança na legislação — ${lei.nome}`,
            body: snippet.slice(0, 150),
            url: lei.url,
            tag: `focali-lei-update-${lei.slug}`,
          });
          for (const sub of subs ?? []) {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
          }
          await supabase.from('lei_source_checks').update({ last_alert_sent_at: now }).eq('slug', lei.slug);
        } catch (e) {
          console.error(`Push falhou para ${lei.slug}:`, e);
          // Não é fatal — o alerta já está gravado em lei_source_checks, dá pra consultar por SQL.
        }
      }
    } catch (e) {
      console.error(`Erro verificando ${lei.slug}:`, e);
      results[lei.slug] = `exceção: ${e instanceof Error ? e.message : String(e)}`;
      failed++;
    }
  }

  return new Response(JSON.stringify({ checked, changed, failed, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
