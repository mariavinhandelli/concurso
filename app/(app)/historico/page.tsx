// M1 — Histórico virou aba do destino único /progresso.
// Redirect preserva bookmarks, pushes e links externos.
import { redirect } from 'next/navigation';

export default function HistoricoRedirect() {
  redirect('/progresso/historico');
}
