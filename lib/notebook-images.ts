// lib/notebook-images.ts
// O bucket notebook-images é PRIVADO (migração 20260712090000). No banco, o
// JSON do tiptap guarda sempre a URL canônica (formato /object/public/...) —
// estável, sem token, igual ao que já existia quando o bucket era público.
// Na exibição, signNotebookImages troca cada src por uma signed URL temporária;
// ao salvar, unsignNotebookImages desfaz a troca de volta para a canônica.
import { createClient } from '@/lib/supabase/client';

const BUCKET = 'notebook-images';
export const SIGN_TTL_SECONDS = 60 * 60 * 24; // 24h — cobre a sessão de leitura/edição

const SRC_RE = new RegExp(`/storage/v1/object/(?:public|sign)/${BUCKET}/([^?]+)`);

type TiptapNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
};

// Extrai o caminho do objeto a partir de qualquer forma de URL do bucket
// (canônica ou assinada). Retorna null para imagens de fora do bucket.
export function extractNotebookPath(src: string): string | null {
  const m = src.match(SRC_RE);
  return m ? m[1] : null;
}

export function canonicalNotebookUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

function collectImageNodes(node: TiptapNode, out: TiptapNode[]) {
  if (node.type === 'image' && typeof node.attrs?.src === 'string') out.push(node);
  node.content?.forEach((child) => collectImageNodes(child, out));
}

// Signed URL para um objeto recém-subido (usada pelo editor ao inserir imagem).
export async function signedNotebookUrl(path: string): Promise<string> {
  const { data, error } = await createClient()
    .storage.from(BUCKET)
    .createSignedUrl(path, SIGN_TTL_SECONDS);
  if (error || !data?.signedUrl) throw error ?? new Error('Falha ao gerar URL da imagem');
  return data.signedUrl;
}

// Troca as URLs canônicas do conteúdo por signed URLs, em lote.
// Devolve o MESMO objeto se não houver nada a assinar ou se a assinatura
// falhar (imagem quebrada é melhor que nota inacessível).
export async function signNotebookImages<T extends object>(content: T): Promise<T> {
  const clone = structuredClone(content) as TiptapNode;
  const nodes: TiptapNode[] = [];
  collectImageNodes(clone, nodes);
  const paths = [
    ...new Set(
      nodes
        .map((n) => extractNotebookPath(n.attrs!.src as string))
        .filter((p): p is string => p !== null),
    ),
  ];
  if (paths.length === 0) return content;

  const { data, error } = await createClient()
    .storage.from(BUCKET)
    .createSignedUrls(paths, SIGN_TTL_SECONDS);
  if (error || !data) return content;

  const byPath = new Map(
    data.filter((d) => d.path && d.signedUrl).map((d) => [d.path as string, d.signedUrl]),
  );
  for (const node of nodes) {
    const path = extractNotebookPath(node.attrs!.src as string);
    const signed = path ? byPath.get(path) : undefined;
    if (signed) node.attrs!.src = signed;
  }
  return clone as T;
}

// Reverte signed URLs para a forma canônica antes de persistir.
// Devolve o MESMO objeto se nada mudou (evita re-render/salvamento à toa).
export function unsignNotebookImages<T extends object>(content: T): T {
  const clone = structuredClone(content) as TiptapNode;
  const nodes: TiptapNode[] = [];
  collectImageNodes(clone, nodes);
  let changed = false;
  for (const node of nodes) {
    const src = node.attrs!.src as string;
    if (!src.includes('/storage/v1/object/sign/')) continue;
    const path = extractNotebookPath(src);
    if (path) {
      node.attrs!.src = canonicalNotebookUrl(path);
      changed = true;
    }
  }
  return changed ? (clone as T) : content;
}
