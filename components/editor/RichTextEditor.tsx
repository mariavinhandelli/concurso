// components/editor/RichTextEditor.tsx
// Editor Tiptap v3: formatação, marca-texto multicolor, cor de letra, listas,
// imagens (colar ou escolher arquivo, com compressão e upload pro Storage),
// Bubble Menu pra flashcard, e coluna de leitura confortável.
'use client';

import { useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { createClient } from '@/lib/supabase/client';
import { theme } from '@/lib/theme';

interface Props {
  initialContent?: object | null;
  onChange?: (json: object, text: string) => void;
  onCreateFlashcard?: (selectedText: string) => void;
  canCreateFlashcard?: boolean;
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
  bold: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z"/></svg>,
  italic: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>,
  h1: <svg width="18" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h8M4 18V6M12 18V6"/><path d="M17 12l3-2v8"/></svg>,
  h2: <svg width="18" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h8M4 18V6M12 18V6"/><path d="M21 18h-4c0-2 3.5-2.5 3.5-4.5A1.5 1.5 0 0 0 17 12"/></svg>,
  bullet: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>,
  ordered: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><path d="M4 6h1v4M4 10h2"/><path d="M4 14h2v1l-2 1v1h2"/></svg>,
  image: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>,
  highlight: <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
  <path d="M0 0h24v24H0z" fill="none" />
  <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
    <path d="m9 11l-6 6v3h9l3-3" />
    <path d="m22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
  </g>
</svg>
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

export function RichTextEditor({ initialContent = null, onChange, onCreateFlashcard, canCreateFlashcard = true }: Props) {
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
    onUpdate: ({ editor }) => onChange?.(editor.getJSON(), editor.getText()),
  });

  // Sobe a imagem pro Storage e insere no editor.
  async function uploadAndInsert(file: File) {
    if (!editor) return;
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

      const { data: pub } = supabase.storage.from('notebook-images').getPublicUrl(nome);
      editor.chain().focus().setImage({ src: pub.publicUrl }).run();
    } catch (e) {
      alert('Erro ao enviar imagem: ' + (e instanceof Error ? e.message : 'desconhecido'));
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
      alert('Salve o erro primeiro para criar um flashcard a partir dele.');
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
        .rte-content:empty:before { content: "Descreva o erro, a pegadinha e a correção… (cole um print com Ctrl+V)"; color: var(--ink-faint); }
      `}</style>

      <BubbleMenu
        editor={editor}
        shouldShow={({ state }) => {
          const { from, to } = state.selection;
          return to > from;
        }}
      >
        <div style={styles.bubble}>
          <button onClick={handleFlashcard} style={styles.bubbleBtn}>✦ Criar Flashcard</button>
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
        <div style={styles.paletteWrap}>
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

        <div style={styles.paletteWrap}>
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
  btn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minWidth: 34, height: 34, padding: '0 8px', borderRadius: 8, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.ink, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  btnActive: { background: theme.tealBg, borderColor: theme.teal, color: theme.tealDeep },
  colorUnderline: { position: 'absolute', bottom: 5, left: 9, right: 9, height: 3, borderRadius: 2, background: 'linear-gradient(90deg,#f70000,#00cf61,#185dcc)' },
  divider: { width: 1, height: 22, background: theme.line, margin: '0 2px' },
  paletteWrap: { position: 'relative' },
  palette: { position: 'absolute', top: 40, left: 0, zIndex: 10, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, padding: 10, background: theme.card, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: 12, boxShadow: theme.shadowHover, width: 200 },
  swatch: { width: 22, height: 22, borderRadius: 6, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, cursor: 'pointer', padding: 0 },
  clearSwatch: { width: 22, height: 22, borderRadius: 6, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, cursor: 'pointer', color: theme.inkFaint, fontSize: 12, padding: 0 },
  editorArea: { padding: 16, color: theme.ink, fontSize: 15, lineHeight: 1.7, overflowX: 'hidden' },
  uploadingNote: { fontSize: 12.5, color: theme.teal, fontWeight: 600, margin: '8px 0 0' },
  bubble: { background: theme.card, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: 10, boxShadow: theme.shadowHover, padding: 4 },
  bubbleBtn: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '6px 12px', whiteSpace: 'nowrap' },
};