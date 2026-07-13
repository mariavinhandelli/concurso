// app/nota-pdf/[id]/page.tsx
// Exportação de anotação em PDF — rota FORA do grupo (app), então não herda
// sidebar/topbar: só o conteúdo, pronto pra impressão. "Baixar PDF" usa o
// diálogo de impressão nativo do navegador (Salvar como PDF) — sem lib nova,
// generateHTML já vem no @tiptap/core que o editor já usa.
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Printer } from 'lucide-react';
import { generateHTML } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { getStudyNote, NOTA_KINDS, type StudyNote } from '@/services/studyNotes.service';
import { signNotebookImages } from '@/lib/notebook-images';
import { theme } from '@/lib/theme';

const EXTENSIONS = [StarterKit, TextStyle, Color, Highlight.configure({ multicolor: true }), Image];

export default function NotaPdfPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [nota, setNota] = useState<StudyNote | null>(null);
  const [erro, setErro] = useState('');
  const [html, setHtml] = useState('');

  useEffect(() => {
    let cancelled = false;
    getStudyNote(id)
      .then(async (n) => {
        if (cancelled) return;
        if (!n) { setErro('Anotação não encontrada.'); return; }
        setNota(n);
        try {
          // bucket privado: troca URLs canônicas das imagens por signed URLs
          const signed = n.content ? await signNotebookImages(n.content) : null;
          if (cancelled) return;
          setHtml(signed ? generateHTML(signed, EXTENSIONS) : '<p></p>');
        } catch {
          setHtml('<p>(não foi possível renderizar o conteúdo)</p>');
        }
      })
      .catch((e) => { if (!cancelled) setErro(e instanceof Error ? e.message : 'Erro ao carregar.'); });
    return () => { cancelled = true; };
  }, [id]);

  if (erro) {
    return (
      <div style={styles.wrap}>
        <p style={{ color: theme.danger }}>{erro}</p>
        <button onClick={() => router.push('/caderno')} style={styles.voltarBtn}>Voltar ao Caderno</button>
      </div>
    );
  }

  if (!nota) {
    return <div style={styles.wrap}><p style={{ color: theme.inkFaint }}>Preparando…</p></div>;
  }

  const kindLabel = NOTA_KINDS.find((k) => k.value === nota.kind)?.label ?? nota.kind;
  const dataFmt = new Date(nota.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div style={styles.wrap}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
        .nota-pdf-content h1 { font-size: 1.6em; font-weight: 700; margin: 0.6em 0 0.3em; }
        .nota-pdf-content h2 { font-size: 1.3em; font-weight: 600; margin: 0.6em 0 0.3em; }
        .nota-pdf-content p { margin: 0.5em 0; }
        .nota-pdf-content ul { list-style: disc; padding-left: 1.5em; }
        .nota-pdf-content ol { list-style: decimal; padding-left: 1.5em; }
        .nota-pdf-content mark { border-radius: 3px; padding: 0 2px; }
        .nota-pdf-content img { max-width: 100%; height: auto; border-radius: 8px; margin: 0.6em 0; }
      `}</style>

      <div className="no-print" style={styles.toolbar}>
        <button onClick={() => router.push('/caderno')} style={styles.voltarBtn}>← Voltar ao Caderno</button>
        <button onClick={() => window.print()} style={styles.printBtn}><Printer size={14} strokeWidth={2} /> Baixar / Imprimir PDF</button>
      </div>

      <div style={styles.folha}>
        <p style={styles.eyebrow}>{kindLabel} · Focali</p>
        <h1 style={styles.titulo}>{nota.title || 'Sem título'}</h1>
        <p style={styles.meta}>
          {[nota.topicName].filter(Boolean).join(' · ')}
          {nota.topicName ? ' · ' : ''}
          atualizado em {dataFmt}
        </p>
        <div className="nota-pdf-content" style={styles.conteudo} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 760, margin: '0 auto', padding: '28px 24px 60px', fontFamily: theme.font, minHeight: '100vh', background: theme.bg },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 10, flexWrap: 'wrap' },
  voltarBtn: { border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '9px 14px', borderRadius: theme.radiusSm },
  printBtn: { border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '10px 16px', borderRadius: theme.radiusSm },
  folha: { background: theme.card, borderRadius: theme.radius, padding: '40px 48px', boxShadow: theme.shadow },
  eyebrow: { fontSize: 12, fontWeight: 700, color: theme.teal, letterSpacing: 0.6, textTransform: 'uppercase', margin: '0 0 8px' },
  titulo: { fontSize: 26, fontWeight: 800, color: theme.ink, margin: '0 0 6px', letterSpacing: -0.4 },
  meta: { fontSize: 13, color: theme.inkFaint, margin: '0 0 24px', paddingBottom: 20, borderBottom: `0.5px solid ${theme.line}` },
  conteudo: { fontSize: 15, lineHeight: 1.75, color: theme.ink },
};
