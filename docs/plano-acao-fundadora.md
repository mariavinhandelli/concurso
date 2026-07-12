# Plano de ação — o que é 100% Maria

Saída da due diligence de 12/07/2026. Tudo aqui exige identidade, assinatura ou
decisão da fundadora — não dá para delegar ao Claude. O que dá para delegar
(código, textos, SEO, paywall) está na seção final.

## Semana 1

1. **Supabase — ligar "Leaked password protection"** (2 minutos)
   Dashboard → Authentication → Settings → Password protection. Item médio da
   auditoria de segurança que só o dono do dashboard pode ligar.

2. **Abrir a empresa** (1–3 semanas de trâmite; começar já)
   - Falar com contador (ou Contabilizei/Agilize): "SaaS B2C de assinatura".
   - Simples Nacional; CNAE de portais/conteúdo (6319-4/00) + software.
   - MEI provavelmente NÃO serve para SaaS (CNAEs de software ficam fora do
     MEI) — confirmar com o contador antes de descartar.
   - Custo típico: taxas de abertura + R$ 200–400/mês de contabilidade.

3. **Criar conta no gateway de pagamento** (KYC pessoal: selfie, dados bancários)
   - Recomendação: **Mercado Pago Assinaturas** para começar — aceita CPF
     enquanto o CNPJ não sai, Pix nativo, público brasileiro.
   - Stripe exige CNPJ no Brasil; pode entrar depois, para cartão internacional.
   - Sem essa conta criada, o paywall não pode ser implementado.

4. **Definir o preço-hipótese** (decisão de 10 minutos, não precisa ser a final)
   - Referências: Estudaqui ~R$ 30/mês; Aprovado ~R$ 15/mês.
   - Sugestão de partida: R$ 24,90/mês ou R$ 199/ano.
   - Decidir também o corte free/pro (proposta: free = 1 concurso ativo e sem
     Raio-X/Vade Mecum anotado; pro = tudo).

## Semanas 2–4

5. **Revisão jurídica** dos Termos de Uso + Política de Privacidade
   Rascunhos JÁ PUBLICADOS em `/termos` e `/privacidade` (páginas públicas). O
   advogado revisa o texto ao vivo. Antes de considerar válidos, é preciso
   preencher os campos marcados com 【…】 no código:
   - `app/(legal)/termos/page.tsx` e `app/(legal)/privacidade/page.tsx`:
     razão social, CNPJ, cidade/UF do foro, preço final, gateway escolhido,
     nome do encarregado (DPO) e e-mails de contato/privacidade.
   - Custo da revisão: R$ 500–1.500 one-off.

6. **Recrutar os 20 primeiros testadores de fora** — só você tem legitimidade
   de fundadora para isso:
   - Grupos de Telegram/WhatsApp de concursos (carreiras policiais e fiscais
     são as comunidades mais ativas).
   - Reddit r/concursospublicos; TikTok/Instagram #concurseira.
   - O texto do post eu escrevo; o rosto e o perfil são seus.

7. **1 vídeo de 60s** mostrando o Plano de Hoje (tela + voz basta).

## Mês 2–3

8. **100 usuários ativos que não te conhecem** + 10 entrevistas/mês.
9. **Decisão estratégica**: negócio (buscar cofundador/a de growth) ou produto
   indie. As duas são válidas; o plano muda completamente conforme a escolha.

## O que fica com o Claude (pedir em qualquer sessão)

- Paywall completo assim que a conta do gateway existir.
- Páginas públicas SEO (leis/jurisprudências indexáveis com CTA).
- PWA offline + wrapper Capacitor para as lojas.
- Testes E2E (Playwright) dos 5 fluxos vitais.
- Texto de recrutamento de testadores e roteiro do vídeo.

## Já feito (12/07/2026)

- ✅ Críticos de segurança de storage: policies com dono + bucket
  `notebook-images` privado com signed URLs (migração
  `20260712090000_storage_owner_policies`), validado com teste de invasão
  real contra a API.
- ✅ Cache do React Query já era limpo no logout (QueryProvider).
- ✅ Rascunhos de Termos (`/termos`) e Política de Privacidade LGPD
  (`/privacidade`) publicados como páginas públicas, linkados no cadastro,
  liberados no `proxy.ts`. Inventário de dados baseado no schema real. Faltam
  só os campos 【…】 (empresa/DPO) e a revisão do advogado.
