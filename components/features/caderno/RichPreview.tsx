// components/features/caderno/RichPreview.tsx
// Prévia SOMENTE-LEITURA de conteúdo Tiptap (notas ricas e erros) na aba
// "Tudo" do Caderno. Antes a prévia mostrava o content_text puro: negrito,
// marca-texto, listas e imagens sumiam e as quebras da extração viravam
// buracos — "toda desconfigurada". Mesmo motor e mesmas extensões do
// RichTextEditor, sem toolbar e sem edição.
'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { signNotebookImages } from '@/lib/notebook-images';

export function RichPreview({ content }: { content: object }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content,
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: 'rte-content rte-preview' } },
  });

  // Bucket privado: troca as URLs canônicas por signed URLs para exibir.
  useEffect(() => {
    if (!editor) return;
    let cancelled = false;
    signNotebookImages(content).then((signed) => {
      if (cancelled || editor.isDestroyed || signed === content) return;
      editor.commands.setContent(signed, { emitUpdate: false });
    });
    return () => { cancelled = true; };
  }, [editor, content]);

  if (!editor) return null;

  return (
    <>
      {/* Mesmas regras visuais do .rte-content do RichTextEditor (o <style>
          de lá só existe com o editor montado). min-height zerado: prévia
          não precisa da altura de área de digitação. */}
      <style>{`
        .rte-preview { outline: none; overflow-wrap: break-word; word-break: break-word; }
        .rte-preview ul { list-style: disc; padding-left: 1.5em; margin: 0.5em 0; }
        .rte-preview ol { list-style: decimal; padding-left: 1.5em; margin: 0.5em 0; }
        .rte-preview li { margin: 0.2em 0; }
        .rte-preview h1 { font-size: 1.6em; font-weight: 700; margin: 0.6em 0 0.3em; color: var(--ink); line-height: 1.3; }
        .rte-preview h2 { font-size: 1.3em; font-weight: 600; margin: 0.6em 0 0.3em; color: var(--ink); line-height: 1.35; }
        .rte-preview p { margin: 0.4em 0; }
        .rte-preview mark { border-radius: 3px; padding: 0 2px; }
        .rte-preview img { max-width: 100%; height: auto; border-radius: 10px; margin: 0.5em 0; display: block; }
      `}</style>
      <EditorContent editor={editor} />
    </>
  );
}
