import { describe, it, expect } from 'vitest';
import config from '../next.config';

describe('CSP de img-src (auditoria de Amigos, P1-6)', () => {
  it('emite img-src para todas as rotas, com o Storage do projeto liberado', async () => {
    expect(typeof config.headers).toBe('function');
    const regras = await config.headers!();
    expect(regras).toHaveLength(1);
    expect(regras[0].source).toBe('/:path*');

    const header = regras[0].headers.find((h) => h.key === 'Content-Security-Policy');
    expect(header).toBeDefined();
    const valor = header!.value;

    expect(valor).toContain("img-src 'self'");
    expect(valor).toContain('data:');
    expect(valor).toContain('blob:');
    expect(valor).toContain('supabase.co');
    // Só declaramos img-src de propósito: script-src exigiria nonce no middleware.
    expect(valor).not.toContain('script-src');
    expect(valor).not.toContain('default-src');
  });
});
