// supabase/functions/check-lei-updates/index.ts
// Check semanal de atualização de legislação. Roda via pg_cron toda
// segunda-feira. Busca o texto da fonte oficial (Planalto / Casa Civil GO) de
// cada uma das 39 leis do Vade Mecum, compara com o hash salvo na última
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
  { slug: 'cf-88', nome: 'CF/88', url: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm' },
  { slug: 'lei-14133', nome: 'Lei 14.133/21', url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm' },
  { slug: 'lei-8429', nome: 'Lei 8.429/92', url: 'https://www.planalto.gov.br/ccivil_03/leis/l8429.htm' },
  { slug: 'lei-9784', nome: 'Lei 9.784/99', url: 'https://www.planalto.gov.br/ccivil_03/leis/l9784.htm' },
  { slug: 'lei-12527', nome: 'LAI 12.527/11', url: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm' },
  { slug: 'lgpd', nome: 'LGPD', url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm' },
  { slug: 'go-13800', nome: 'GO 13.800/01', url: 'https://legisla.casacivil.go.gov.br/pesquisa_legislacao/81441/lei-13800' },
  { slug: 'cp', nome: 'Código Penal', url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm' },
  { slug: 'cpp', nome: 'CPP', url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689compilado.htm' },
  { slug: 'cpm', nome: 'CPM', url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del1001compilado.htm' },
  { slug: 'cppm', nome: 'CPPM', url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del1002compilado.htm' },
  { slug: 'lei-8987', nome: 'Lei 8.987/95', url: 'https://www.planalto.gov.br/ccivil_03/leis/l8987cons.htm' },
  { slug: 'lei-11079', nome: 'Lei 11.079/04 (PPP)', url: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l11079.htm' },
  { slug: 'lindb', nome: 'LINDB', url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del4657compilado.htm' },
  { slug: 'lei-9637', nome: 'Lei 9.637/98 (OS)', url: 'https://www.planalto.gov.br/ccivil_03/leis/l9637.htm' },
  { slug: 'lei-9790', nome: 'Lei 9.790/99 (OSCIP)', url: 'https://www.planalto.gov.br/ccivil_03/leis/l9790.htm' },
  { slug: 'lei-8112', nome: 'Lei 8.112/90', url: 'https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm' },
  { slug: 'lei-12846', nome: 'Lei 12.846/13', url: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12846.htm' },
  { slug: 'cdc', nome: 'CDC', url: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm' },
  { slug: 'ctn', nome: 'CTN', url: 'https://www.planalto.gov.br/ccivil_03/leis/l5172compilado.htm' },
  { slug: 'cc', nome: 'Código Civil', url: 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm' },
  { slug: 'cpc', nome: 'CPC', url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm' },
  { slug: 'clt', nome: 'CLT', url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm' },
  { slug: 'eca', nome: 'ECA', url: 'https://www.planalto.gov.br/ccivil_03/leis/l8069compilado.htm' },
  { slug: 'lei-12016', nome: 'Lei 12.016/09 (MS)', url: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l12016.htm' },
  { slug: 'lei-7347', nome: 'Lei 7.347/85 (ACP)', url: 'https://www.planalto.gov.br/ccivil_03/leis/l7347compilada.htm' },
  { slug: 'lei-11343', nome: 'Lei 11.343/06 (Drogas)', url: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11343.htm' },
  { slug: 'lei-10826', nome: 'Lei 10.826/03 (Desarmamento)', url: 'https://www.planalto.gov.br/ccivil_03/leis/2003/l10.826.htm' },
  { slug: 'lei-11340', nome: 'Lei 11.340/06 (Maria da Penha)', url: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11340.htm' },
  { slug: 'lei-8072', nome: 'Lei 8.072/90 (Hediondos)', url: 'https://www.planalto.gov.br/ccivil_03/leis/l8072.htm' },
  { slug: 'lei-9455', nome: 'Lei 9.455/97 (Tortura)', url: 'https://www.planalto.gov.br/ccivil_03/leis/l9455.htm' },
  { slug: 'lei-12850', nome: 'Lei 12.850/13 (ORCRIM)', url: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12850.htm' },
  { slug: 'lei-13869', nome: 'Lei 13.869/19 (Abuso)', url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/l13869.htm' },
  { slug: 'lei-9613', nome: 'Lei 9.613/98 (Lavagem)', url: 'https://www.planalto.gov.br/ccivil_03/leis/l9613compilado.htm' },
  { slug: 'lei-7210', nome: 'LEP (Lei 7.210/84)', url: 'https://www.planalto.gov.br/ccivil_03/leis/l7210compilado.htm' },
  { slug: 'lei-9099', nome: 'Lei 9.099/95 (JECrim)', url: 'https://www.planalto.gov.br/ccivil_03/leis/l9099.htm' },
  { slug: 'lei-9296', nome: 'Lei 9.296/96 (Interceptação)', url: 'https://www.planalto.gov.br/ccivil_03/leis/l9296.htm' },
  { slug: 'lrf', nome: 'LRF (LC 101/00)', url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp101.htm' },
  { slug: 'lei-4320', nome: 'Lei 4.320/64', url: 'https://www.planalto.gov.br/ccivil_03/leis/l4320compilado.htm' },
];

// O Planalto declara ISO-8859-1 mas serve Windows-1252. Decodificar como UTF-8
// (o padrão de res.text()) transforma todo acento em "�" — o alerta de diff
// chegava ilegível. Decodifica pelo charset certo antes de virar texto.
function decodificar(buf: ArrayBuffer, contentType: string | null): string {
  const bytes = new Uint8Array(buf);
  // Algumas páginas (ex.: Lei 11.340) são UTF-16 e o Planalto NÃO declara o
  // charset no content-type. Lidas como 1 byte por caractere, viram texto com
  // \u0000 no meio — que o Postgres recusa, e a lei nunca criava linha de base.
  // O BOM é a única pista confiável, então vem antes do content-type.
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(buf);
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(buf);
  const declarado = (contentType ?? '').toLowerCase();
  const charset = /utf-?8/.test(declarado) ? 'utf-8' : 'windows-1252';
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
}

// Uma falha isolada de rede não pode zerar a verificação da semana: tenta de novo
// uma vez, com uma pausa curta.
async function buscarComRetry(url: string): Promise<Response> {
  const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; FocaliBot/1.0; +mailto:mariavinhandelli@gmail.com)' };
  try {
    const res = await fetch(url, { headers });
    if (res.ok) return res;
    await new Promise((r) => setTimeout(r, 1500));
    return await fetch(url, { headers });
  } catch (e) {
    await new Promise((r) => setTimeout(r, 1500));
    return await fetch(url, { headers });
  }
}

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
    // rede de segurança: caractere nulo é recusado por coluna text do Postgres
    .replace(/\u0000/g, '')
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

type Resultado = { slug: string; status: string; tipo: 'ok' | 'changed' | 'failed' };

// Verifica UMA lei. Devolve o resultado em vez de mutar contadores — assim dá
// para rodar várias em paralelo sem corrida.
async function verificarLei(lei: { slug: string; nome: string; url: string }): Promise<Resultado> {
  try {
      const res = await buscarComRetry(lei.url);
      if (!res.ok) {
        return { slug: lei.slug, status: `fetch falhou: HTTP ${res.status}`, tipo: 'failed' };
      }
      const html = decodificar(await res.arrayBuffer(), res.headers.get('content-type'));
      const text = htmlToPlainText(html);
      if (text.length < 500) {
        // Página vazia/bloqueada não deve virar "mudança" — texto real de lei
        // sempre tem milhares de caracteres.
        return { slug: lei.slug, status: 'texto extraído suspeito (muito curto) — pulado', tipo: 'failed' };
      }
      const hash = await sha256Hex(text);

      // Só o HASH aqui. Trazer `source_text` (até ~1,4 MB por lei, caso do Código
      // Civil) em toda verificação estourava o limite de recursos da função —
      // erro 546 no meio da fatia. O texto anterior só interessa quando o hash
      // muda, e nesse caso é buscado logo abaixo.
      const { data: prev } = await supabase
        .from('lei_source_checks')
        .select('source_hash')
        .eq('slug', lei.slug)
        .maybeSingle();

      const now = new Date().toISOString();

      if (!prev || !prev.source_hash) {
        // Primeira verificação desta lei: só estabelece a linha de base.
        await supabase.from('lei_source_checks').upsert({
          slug: lei.slug, source_url: lei.url, source_hash: hash, source_text: text,
          last_checked_at: now,
        });
        return { slug: lei.slug, status: 'linha de base estabelecida (primeira verificação)', tipo: 'ok' };
      }

      if (prev.source_hash === hash) {
        await supabase.from('lei_source_checks').update({ last_checked_at: now }).eq('slug', lei.slug);
        return { slug: lei.slug, status: 'sem mudança', tipo: 'ok' };
      }

      // Mudou: agora sim vale carregar o texto anterior, só para montar o diff.
      const { data: anterior } = await supabase
        .from('lei_source_checks')
        .select('source_text')
        .eq('slug', lei.slug)
        .maybeSingle();
      const snippet = buildDiffSnippet(anterior?.source_text ?? '', text);
      await supabase.from('lei_source_checks').update({
        source_hash: hash, source_text: text, last_checked_at: now,
        last_changed_at: now, diff_snippet: snippet,
      }).eq('slug', lei.slug);

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
      return { slug: lei.slug, status: 'MUDANÇA DETECTADA', tipo: 'changed' };
    } catch (e) {
      console.error(`Erro verificando ${lei.slug}:`, e);
      return { slug: lei.slug, status: `exceção: ${e instanceof Error ? e.message : String(e)}`, tipo: 'failed' };
  }
}

// Quantas leis por execução. As 39 fontes somam ~30 MB de HTML; baixar,
// decodificar, limpar tags e hashear tudo de uma vez estoura o limite de CPU da
// função (a tentativa com todas de uma vez morreu no primeiro lote). Por isso cada execução
// cuida de uma FATIA — as menos recentemente verificadas — e o cron roda todo
// dia, de modo que as 39 são cobertas a cada ~5 dias.
const POR_EXECUCAO = 8;
// Requisições simultâneas dentro da fatia: com 6, o Planalto recusou 5 de 6.
const LOTE = 4;

Deno.serve(async () => {
  const results: Record<string, string> = {};
  let checked = 0, changed = 0, failed = 0;

  const { data: existentes } = await supabase
    .from('lei_source_checks')
    .select('slug, last_checked_at');
  const visto = new Map((existentes ?? []).map((r) => [r.slug, r.last_checked_at]));

  // nunca verificada vem primeiro (timestamp 0); depois, da mais antiga para a mais recente
  const quando = (slug: string) => {
    const t = visto.get(slug);
    return t ? new Date(t).getTime() : 0;
  };
  const fila = [...LEIS].sort((a, b) => quando(a.slug) - quando(b.slug)).slice(0, POR_EXECUCAO);

  for (let i = 0; i < fila.length; i += LOTE) {
    const lote = await Promise.all(fila.slice(i, i + LOTE).map(verificarLei));
    for (const r of lote) {
      results[r.slug] = r.status;
      if (r.tipo === 'changed') { changed++; checked++; }
      else if (r.tipo === 'ok') checked++;
      else failed++;
    }
  }

  return new Response(JSON.stringify({
    cadastradas: LEIS.length, nestaExecucao: fila.length, checked, changed, failed, results,
  }), { headers: { 'Content-Type': 'application/json' } });
});
