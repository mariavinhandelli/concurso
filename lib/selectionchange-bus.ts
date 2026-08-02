'use client';
// lib/selectionchange-bus.ts
// Auditoria de performance (02/08) — cada ArtigoCard montado (Vade Mecum)
// registrava seu PRÓPRIO listener de `selectionchange` + seu PRÓPRIO debounce
// (setTimeout de 250ms). Abrir vários capítulos numa lei grande, ou usar o
// filtro por cor/favoritos, monta dezenas de cards ao mesmo tempo — cada
// seleção de texto na página disparava N listeners e N timers em paralelo,
// mesmo que a seleção estivesse em só um deles.
//
// Este módulo mantém UM único `addEventListener('selectionchange')` + UM
// único debounce, e repassa o evento (já debounced) pra todos os assinantes.
// A lógica de "essa seleção é MINHA?" continua em cada card (não mudou nada
// aqui) — só a inscrição no evento nativo do browser é compartilhada.
const callbacks = new Set<() => void>();
let attached = false;
let timer: ReturnType<typeof setTimeout> | undefined;

function fireAll() {
  for (const cb of callbacks) cb();
}

function ensureListener() {
  if (attached || typeof document === 'undefined') return;
  attached = true;
  document.addEventListener('selectionchange', () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fireAll, 250);
  });
}

/** Assina mudanças de seleção (já debounced em 250ms). Retorna a função de cleanup. */
export function subscribeSelectionChange(callback: () => void): () => void {
  ensureListener();
  callbacks.add(callback);
  return () => { callbacks.delete(callback); };
}
