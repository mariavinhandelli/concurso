// components/editor/RichTextEditor.tsx
// Editor Tiptap v3: formatação, marca-texto multicolor, cor de letra, listas,
// imagens (colar ou escolher arquivo, com compressão e upload pro Storage),
// Bubble Menu pra flashcard, e coluna de leitura confortável.
'use client';

import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Image as ImageIcon, Highlighter, Sparkles } from 'lucide-react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { createClient } from '@/lib/supabase/client';
import { signNotebookImages, unsignNotebookImages, signedNotebookUrl } from '@/lib/notebook-images';
import { theme, zIndex } from '@/lib/theme';
import { useToast } from '@/components/ui/ToastProvider';

interface Props {
  initialContent?: object | null;
  onChange?: (json: object, text: string) => void;
  onCreateFlashcard?: (selectedText: string) => void;
  canCreateFlashcard?: boolean;
  placeholder?: string;
}

const TEXT_COLORS = [
  'var(--ink)', '#f70000', '#fff200', '#b32c76',
  '#00cf61', '#0E7C6B', '#185dcc', '#ff94b8',
  '#8B3FC9', '#A87BC9', '#ff006f', '#7fe7e2',
];

const HIGHLIGHT_COLORS = [
  '#FFF3A3', '#FFD8A8', '#cb9278', '#FFC9C9',
  '#FCC2D7', '#ffa6a6', '#D8C2FF', '#b8a6be',  
  '#C5E0FF', '#C3FAE8', '#D3F9D8','#a1feb0', 
];

const Icon = {
  bold: <Bold size={16} strokeWidth={2.4} />,
  italic: <Italic size={16} strokeWidth={2} />,
  h1: <Heading1 size={18} strokeWidth={2} />,
  h2: <Heading2 size={18} strokeWidth={2} />,
  bullet: <List size={16} strokeWidth={2} />,
  ordered: <ListOrdered size={16} strokeWidth={2} />,
  image: <ImageIcon size={16} strokeWidth={2} />,
  highlight: <Highlighter size="1em" strokeWidth={2} />,
};

// Comprime/redimensiona a imagem antes de subir. Prints grandes ficam leves.
async function compressImage(file: File): Promise<Blob> {
  const MAX_W = 1600;
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = document.createElement('img');
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const scale = img.width > MAX_W ? MAX_W / img.width : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((res) => {
    canvas.toBlob((b) => res(b ?? file), 'image/jpeg', 0.8);
  });
}

export function RichTextEditor({
  initialContent = null, onChange, onCreateFlashcard, canCreateFlashcard = true,
  placeholder = 'Descreva o erro, a pegadinha e a correção… (cole um print com Ctrl+V)',
}: Props) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: initialContent ?? '',
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'rte-content' },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              event.preventDefault();
              uploadAndInsert(file);
              return true;
            }
          }
        }
        return false;
      },
    },
    // unsign: o bucket é privado e o editor exibe signed URLs temporárias,
    // mas o banco guarda sempre a URL canônica (sem token).
    onUpdate: ({ editor }) => onChange?.(unsignNotebookImages(editor.getJSON()), editor.getText()),
  });

  // Conteúdo salvo chega com URLs canônicas; troca por signed URLs para exibir.
  useEffect(() => {
    if (!editor || !initialContent) return;
    let cancelled = false;
    signNotebookImages(initialContent).then((signed) => {
      if (cancelled || editor.isDestroyed || signed === initialContent) return;
      editor.commands.setContent(signed, { emitUpdate: false });
    });
    return () => { cancelled = true; };
    // initialContent é só o valor de montagem — assinar de novo a cada
    // digitação do pai causaria loop de setContent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Sobe a imagem pro Storage e insere no editor.
  async function uploadAndInsert(file: File) {
    if (!editor) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Imagem muito grande (máximo 20 MB).');
      return;
    }
    setUploading(true);
    try {
      const blob = await compressImage(file);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não logado');

      const nome = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await supabase.storage
        .from('notebook-images')
        .upload(nome, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;

      const signedUrl = await signedNotebookUrl(nome);
      if (!editor.isDestroyed) editor.chain().focus().setImage({ src: signedUrl }).run();
    } catch (e) {
      toast.error('Erro ao enviar imagem: ' + (e instanceof Error ? e.message : 'desconhecido'));
    } finally {
      setUploading(false);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadAndInsert(file);
    e.target.value = ''; // permite escolher o mesmo arquivo de novo
  }

  if (!editor) return null;

  function handleFlashcard() {
    const { from, to } = editor!.state.selection;
    const text = editor!.state.doc.textBetween(from, to, ' ');
    if (!text.trim()) return;
    if (!canCreateFlashcard) {
      toast.error('Salve o erro primeiro para criar um flashcard a partir dele.');
      return;
    }
    onCreateFlashcard?.(text);
  }

  return (
    <div style={styles.wrapper}>
      <style>{`
        .rte-reading { max-width: 680px; }
        .rte-content { outline: none; min-height: 240px; overflow-wrap: break-word; word-break: break-word; }
        .rte-content ul { list-style: disc; padding-left: 1.5em; margin: 0.5em 0; }
        .rte-content ol { list-style: decimal; padding-left: 1.5em; margin: 0.5em 0; }
        .rte-content li { margin: 0.2em 0; }
        .rte-content h1 { font-size: 1.6em; font-weight: 700; margin: 0.6em 0 0.3em; color: var(--ink); line-height: 1.3; }
        .rte-content h2 { font-size: 1.3em; font-weight: 600; margin: 0.6em 0 0.3em; color: var(--ink); line-height: 1.35; }
        .rte-content p { margin: 0.4em 0; }
        .rte-content mark { border-radius: 3px; padding: 0 2px; }
        .rte-content img { max-width: 100%; height: auto; border-radius: 10px; margin: 0.5em 0; display: block; }
        .rte-content img.ProseMirror-selectednode { outline: 2px solid var(--teal); }
        .rte-content > p:only-child:empty::before { content: "${placeholder.replace(/"/g, '\\"')}"; color: var(--ink-faint); pointer-events: none; float: left; height: 0; }
      `}</style>

      <BubbleMenu
        editor={editor}
        shouldShow={({ state }) => {
          const { from, to } = state.selection;
          return to > from;
        }}
      >
        <div style={styles.bubble}>
          <button onClick={handleFlashcard} style={styles.bubbleBtn}><Sparkles size={13} strokeWidth={2} /> Criar Flashcard</button>
        </div>
      </BubbleMenu>

      <Toolbar editor={editor} onPickImage={() => fileInputRef.current?.click()} uploading={uploading} />
      <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickFile} style={{ display: 'none' }} />

      <div style={styles.editorArea}>
        <div className="rte-reading">
          <EditorContent editor={editor} />
          {uploading && <p style={styles.uploadingNote}>Enviando imagem…</p>}
        </div>
      </div>
    </div>
  );
}

function Toolbar({ editor, onPickImage, uploading }: { editor: Editor; onPickImage: () => void; uploading: boolean }) {
  const [openPalette, setOpenPalette] = useState(false);
  const [openHl, setOpenHl] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);
  const hlRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openPalette && !openHl) return;
    function onDown(e: MouseEvent) {
      if (openPalette && paletteRef.current && !paletteRef.current.contains(e.target as Node)) setOpenPalette(false);
      if (openHl && hlRef.current && !hlRef.current.contains(e.target as Node)) setOpenHl(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openPalette, openHl]);

  const btn = (active: boolean): React.CSSProperties => ({
    ...styles.btn,
    ...(active ? styles.btnActive : {}),
  });

  return (
    <div style={styles.toolbar}>
      <div style={styles.group}>
        <button onClick={() => editor.chain().focus().toggleBold().run()}
          style={btn(editor.isActive('bold'))} title="Negrito">{Icon.bold}</button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()}
          style={btn(editor.isActive('italic'))} title="Itálico">{Icon.italic}</button>
      </div>

      <span style={styles.divider} />

      <div style={styles.group}>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          style={btn(editor.isActive('heading', { level: 1 }))} title="Título grande">{Icon.h1}</button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          style={btn(editor.isActive('heading', { level: 2 }))} title="Título médio">{Icon.h2}</button>
      </div>

      <span style={styles.divider} />

      <div style={styles.group}>
        <div style={styles.paletteWrap} ref={paletteRef}>
          <button onClick={() => { setOpenPalette(!openPalette); setOpenHl(false); }}
            style={styles.btn} title="Cor da letra">
            <span style={{ fontWeight: 700, fontSize: 13 }}>A</span>
            <span style={styles.colorUnderline} />
          </button>
          {openPalette && (
            <div style={styles.palette}>
              {TEXT_COLORS.map((c) => (
                <button key={c} onClick={() => { editor.chain().focus().setColor(c).run(); setOpenPalette(false); }}
                  style={{ ...styles.swatch, background: c }} />
              ))}
              <button onClick={() => { editor.chain().focus().unsetColor().run(); setOpenPalette(false); }}
                style={styles.clearSwatch} title="Remover cor">⊘</button>
            </div>
          )}
        </div>

        <div style={styles.paletteWrap} ref={hlRef}>
          <button onClick={() => { setOpenHl(!openHl); setOpenPalette(false); }}
            style={btn(editor.isActive('highlight'))} title="Marca-texto">{Icon.highlight}</button>
          {openHl && (
            <div style={styles.palette}>
              {HIGHLIGHT_COLORS.map((c) => (
                <button key={c} onClick={() => { editor.chain().focus().toggleHighlight({ color: c }).run(); setOpenHl(false); }}
                  style={{ ...styles.swatch, background: c }} />
              ))}
              <button onClick={() => { editor.chain().focus().unsetHighlight().run(); setOpenHl(false); }}
                style={styles.clearSwatch} title="Remover marca">⊘</button>
            </div>
          )}
        </div>
      </div>

      <span style={styles.divider} />

      <div style={styles.group}>
        <button onClick={() => editor.chain().focus().toggleBulletList().run()}
          style={btn(editor.isActive('bulletList'))} title="Lista com marcadores">{Icon.bullet}</button>
        <button onClick={() => editor.chain().focus().toggleOrderedList().run()}
          style={btn(editor.isActive('orderedList'))} title="Lista numerada">{Icon.ordered}</button>
      </div>

      <span style={styles.divider} />

      <div style={styles.group}>
        <button onClick={onPickImage} style={styles.btn} title="Inserir imagem" disabled={uploading}>{Icon.image}</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: 14, overflow: 'hidden', background: theme.card, fontFamily: theme.font },
  toolbar: { display: 'flex', alignItems: 'center', gap: 6, padding: 10, borderBottomWidth: 0.5, borderBottomStyle: 'solid', borderBottomColor: theme.line, background: theme.bg, flexWrap: 'wrap', position: 'relative' },
  group: { display: 'flex', alignItems: 'center', gap: 3 },
  btn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minWidth: 34, height: 34, padding: '0 8px', borderRadius: theme.radiusXs, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.ink, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  btnActive: { background: theme.tealBg, borderColor: theme.teal, color: theme.tealDeep },
  colorUnderline: { position: 'absolute', bottom: 5, left: 9, right: 9, height: 3, borderRadius: 2, background: 'linear-gradient(90deg,#f70000,#00cf61,#185dcc)' },
  divider: { width: 1, height: 22, background: theme.line, margin: '0 2px' },
  paletteWrap: { position: 'relative' },
  palette: { position: 'absolute', top: 40, right: 0, zIndex: zIndex.menu, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, padding: 10, background: theme.card, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: theme.radiusSm, boxShadow: theme.shadowHover, width: 200, maxWidth: 'calc(100vw - 48px)' },
  swatch: { width: 22, height: 22, borderRadius: 6, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, cursor: 'pointer', padding: 0 },
  clearSwatch: { width: 22, height: 22, borderRadius: 6, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, cursor: 'pointer', color: theme.inkFaint, fontSize: 12, padding: 0 },
  editorArea: { padding: 16, color: theme.ink, fontSize: 15, lineHeight: 1.7, overflowX: 'hidden' },
  uploadingNote: { fontSize: 13, color: theme.teal, fontWeight: 600, margin: '8px 0 0' },
  bubble: { background: theme.card, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: 10, boxShadow: theme.shadowHover, padding: 4 },
  bubbleBtn: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '6px 12px', whiteSpace: 'nowrap' },
};