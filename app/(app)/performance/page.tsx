// M1 — Performance virou a aba Evolução do destino único /progresso.
// A rota antiga fica como redirect permanente: bookmarks, pushes e links
// externos continuam funcionando.
import { redirect } from 'next/navigation';

export default function PerformanceRedirect() {
  redirect('/progresso');
}
