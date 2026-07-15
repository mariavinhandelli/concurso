// app/(app)/editais/page.tsx
// O acesso principal ao banco de editais é a aba "Banco de editais" em
// /targets (decisão de navegação do Hub de Editais). Esta rota existe só
// para que /editais seja linkável e leve ao lugar certo.
import { redirect } from 'next/navigation';

export default function EditaisIndexPage() {
  redirect('/targets');
}
