// Testes dos helpers puros de lib/notebook-images.ts (extração de caminho e
// reversão signed→canônica). signNotebookImages depende de rede/Supabase e é
// coberto pelo fluxo manual do editor.
import { beforeAll, describe, expect, it } from 'vitest';
import { canonicalNotebookUrl, extractNotebookPath, unsignNotebookImages } from './notebook-images';

const BASE = 'https://krkbzeqwjrrxvdpwyqar.supabase.co';
const PATH = 'a1b2c3d4-0000-0000-0000-000000000000/1720000000000_abc123.jpg';

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = BASE;
});

describe('extractNotebookPath', () => {
  it('extrai o caminho da URL canônica (pública)', () => {
    expect(extractNotebookPath(`${BASE}/storage/v1/object/public/notebook-images/${PATH}`)).toBe(PATH);
  });

  it('extrai o caminho da signed URL, ignorando o token', () => {
    expect(extractNotebookPath(`${BASE}/storage/v1/object/sign/notebook-images/${PATH}?token=ey.abc`)).toBe(PATH);
  });

  it('devolve null para URLs de fora do bucket', () => {
    expect(extractNotebookPath('https://exemplo.com/foto.jpg')).toBeNull();
    expect(extractNotebookPath(`${BASE}/storage/v1/object/public/avatar/x/avatar.jpg`)).toBeNull();
  });
});

describe('unsignNotebookImages', () => {
  const doc = (src: string) => ({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'oi' }] },
      { type: 'image', attrs: { src } },
    ],
  });

  it('reverte signed URL para a forma canônica', () => {
    const signed = doc(`${BASE}/storage/v1/object/sign/notebook-images/${PATH}?token=ey.abc`);
    const result = unsignNotebookImages(signed);
    expect((result.content[1].attrs as { src: string }).src).toBe(canonicalNotebookUrl(PATH));
    // não muta o original
    expect((signed.content[1].attrs as { src: string }).src).toContain('/object/sign/');
  });

  it('devolve o mesmo objeto quando não há nada a reverter', () => {
    const canonical = doc(canonicalNotebookUrl(PATH));
    expect(unsignNotebookImages(canonical)).toBe(canonical);
    const externa = doc('https://exemplo.com/foto.jpg');
    expect(unsignNotebookImages(externa)).toBe(externa);
  });
});
