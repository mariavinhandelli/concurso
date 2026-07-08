// app/(app)/calendar/page.tsx
// O antigo "Calendário" virou a aba "Mês" do hub Agenda (M9). Esta rota
// permanece só para preservar links/bookmarks antigos, redirecionando.
import { redirect } from 'next/navigation';

export default function CalendarRedirect() {
  redirect('/schedule?view=mes');
}
