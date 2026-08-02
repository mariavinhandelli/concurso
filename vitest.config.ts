import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // Worktrees abandonados sob .claude/worktrees têm sua própria cópia dos
    // arquivos de teste, mas o alias '@' acima sempre resolve pra este repo —
    // sem excluir, um teste desatualizado num worktree roda contra o código
    // ATUAL daqui e falha por divergência, poluindo o resultado de `npm test`.
    exclude: ['**/node_modules/**', '**/.claude/worktrees/**'],
  },
});
