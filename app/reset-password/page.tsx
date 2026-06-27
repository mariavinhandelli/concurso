// app/reset-password/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessaoValida, setSessaoValida] = useState<boolean | null>(null);

  // Ao chegar pelo link do e-mail, o Supabase cria a sessão de recuperação.
  // Confirmamos que ela existe antes de deixar redefinir.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setSessaoValida(!!data.session);
    });
  }, []);

  async function handleReset() {
    if (loading) return;

    if (!password || !confirm) {
      setFeedback({ kind: 'error', text: 'Preencha os dois campos.' });
      return;
    }
    if (password.length < 6) {
      setFeedback({ kind: 'error', text: 'A senha precisa de no mínimo 6 caracteres.' });
      return;
    }
    if (password !== confirm) {
      setFeedback({ kind: 'error', text: 'As senhas não conferem.' });
      return;
    }

    setLoading(true);
    setFeedback(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setFeedback({ kind: 'error', text: 'Não foi possível redefinir. Tente o link de novo.' });
    } else {
      setFeedback({ kind: 'ok', text: 'Senha redefinida! Redirecionando para o login…' });
      await supabase.auth.signOut({ scope: 'local' });
      setTimeout(() => {
        router.push('/login');
        router.refresh();
      }, 1500);
    }
  }

  return (
    <main style={styles.page}>
      <form
        style={styles.card}
        onSubmit={(event) => {
          event.preventDefault();
          void handleReset();
        }}
      >
        <div style={styles.brand}>
          <svg width="18" height="18" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="rp-g1" x1="118" y1="96" x2="319" y2="245" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#22C55E"/><stop offset="1" stopColor="#A7F5D0"/>
              </linearGradient>
              <linearGradient id="rp-g2" x1="118" y1="242" x2="287" y2="303" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#A7F5D0"/><stop offset="1" stopColor="#93C5FD"/>
              </linearGradient>
              <linearGradient id="rp-g3" x1="175" y1="290" x2="312" y2="421" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#6366F1"/><stop offset="1" stopColor="#4338CA"/>
              </linearGradient>
            </defs>
            <path d="M118 151C118 120.624 142.624 96 173 96H331C359.719 96 383 119.281 383 148C383 176.719 359.719 200 331 200H222C193.281 200 170 223.281 170 252V252H118V151Z" fill="url(#rp-g1)"/>
            <path d="M170 252C170 223.281 193.281 200 222 200H292C320.719 200 344 223.281 344 252C344 280.719 320.719 304 292 304H170V252Z" fill="url(#rp-g2)"/>
            <path d="M175 304H227V361C227 391.376 202.376 416 172 416C142.177 416 118 391.823 118 362C118 330 143 304 175 304Z" fill="url(#rp-g3)"/>
          </svg>
          <span style={styles.brandText}>focali</span>
        </div>

        <h1 style={styles.title}>Redefinir senha</h1>
        <p style={styles.subtitle}>Escolha uma nova senha para sua conta.</p>

        {sessaoValida === false ? (
          <p
            style={{
              ...styles.feedback,
              color: 'var(--danger)',
              background: 'var(--danger-bg)',
              marginTop: 8,
            }}
          >
            Link inválido ou expirado. Volte ao login e peça um novo e-mail de redefinição.
          </p>
        ) : (
          <>
            <label htmlFor="new-password" style={styles.label}>Nova senha</label>
            <input
              id="new-password"
              name="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mínimo 6 caracteres"
              autoComplete="new-password"
              required
              minLength={6}
              style={styles.input}
            />

            <label htmlFor="confirm-password" style={styles.label}>Confirmar nova senha</label>
            <input
              id="confirm-password"
              name="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="repita a senha"
              autoComplete="new-password"
              required
              minLength={6}
              style={styles.input}
            />

            <button type="submit" style={styles.primary} disabled={loading}>
              {loading ? 'Aguarde…' : 'Redefinir senha'}
            </button>
          </>
        )}

        {feedback && (
          <p
            role={feedback.kind === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            style={{
              ...styles.feedback,
              color: feedback.kind === 'error' ? 'var(--danger)' : 'var(--ok)',
              background: feedback.kind === 'error' ? 'var(--danger-bg)' : 'var(--ok-bg)',
            }}
          >
            {feedback.text}
          </p>
        )}
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    fontFamily: 'var(--font-poppins), Inter, Arial, sans-serif',
  },
  card: {
    background: 'var(--card)',
    borderRadius: 20,
    padding: 36,
    width: 'min(400px, 90vw)',
    border: '1px solid var(--line)',
    boxShadow: 'var(--shadow)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: 'var(--teal)',
  },
  brandText: {
    fontSize: 17,
    fontWeight: 700,
    color: 'var(--ink)',
    letterSpacing: -0.4,
    fontFamily: 'var(--font-poppins), Inter, Arial, sans-serif',
  },
  title: {
    margin: 0,
    fontSize: 22,
    color: 'var(--ink)',
    fontWeight: 600,
  },
  subtitle: {
    margin: '4px 0 24px',
    fontSize: 14,
    color: 'var(--ink-faint)',
  },
  label: {
    display: 'block',
    fontSize: 13,
    color: 'var(--ink-soft)',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: 12,
    borderRadius: 12,
    border: '1px solid var(--line-strong)',
    background: 'var(--bg)',
    fontSize: 14,
    color: 'var(--ink)',
    fontFamily: 'inherit',
    outline: 'none',
  },
  primary: {
    width: '100%',
    padding: '13px 0',
    borderRadius: 12,
    border: 'none',
    background: 'var(--teal)',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 24,
    fontFamily: 'inherit',
  },
  feedback: {
    fontSize: 13,
    marginTop: 16,
    textAlign: 'center',
    padding: '10px 12px',
    borderRadius: 10,
  },
};
