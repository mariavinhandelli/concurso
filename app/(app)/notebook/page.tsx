// app/(app)/notebook/page.tsx
// O antigo "Cadernos de Erros" virou a aba "Erros" do hub Caderno (M8). Esta
// rota permanece só para preservar links/bookmarks antigos, redirecionando.
import { redirect } from 'next/navigation';

export default function NotebookRedirect() {
  redirect('/caderno?tab=erros');
}
