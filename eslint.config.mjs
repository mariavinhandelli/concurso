import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Dívida existente: os carregamentos em effects serão migrados por tela.
      // Mantemos o diagnóstico visível sem bloquear o CI durante a transição.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  {
    // Guard do design system: hex cru em app/components deveria vir de lib/theme.ts
    // ou das CSS vars de globals.css, não hardcoded — é assim que o app fica
    // inconsistente entre paletas/dark-mode de novo. "warn" (não "error"): há
    // ~180 ocorrências de dívida pré-existente (cores de matéria/gráfico/grifo
    // legítimas) que não travam o build; o objetivo é a dívida NOVA aparecer no
    // review, não bloquear CI. Arquivos com hex legítimo (canvas, OG image,
    // paletas de dados) ficam de fora via "ignores".
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: [
      "app/opengraph-image.tsx",
      "components/features/home/ShareProgressCard.tsx",
      "components/features/profile/AvatarCropper.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "Literal[value=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
          message: "Cor hex crua — use um token de lib/theme.ts ou uma CSS var de globals.css. Se é cor de dado dinâmico (matéria, gráfico), pode ignorar esta linha.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
