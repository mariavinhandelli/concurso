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
      setTimeout(() => {
        router.push('/login');
        router.refresh();
      }, 1500);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleReset();
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <div style={styles.logoDot} />
          <span style={styles.brandText}>Gerenciador de Estudos</span>
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
            <label style={styles.label}>Nova senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="mínimo 6 caracteres"
              autoComplete="new-password"
              style={styles.input}
            />

            <label style={styles.label}>Confirmar nova senha</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="repita a senha"
              autoComplete="new-password"
              style={styles.input}
            />

            <button onClick={handleReset} style={styles.primary} disabled={loading}>
              {loading ? 'Aguarde…' : 'Redefinir senha'}
            </button>
          </>
        )}

        {feedback && (
          <p
            style={{
              ...styles.feedback,
              color: feedback.kind === 'error' ? 'var(--danger)' : 'var(--ok)',
              background: feedback.kind === 'error' ? 'var(--danger-bg)' : 'var(--ok-bg)',
            }}
          >
            {feedback.text}
          </p>
        )}
      </div>
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
    fontFamily: 'var(--font-geist-sans), Arial, sans-serif',
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
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--ink-soft)',
    letterSpacing: 0.2,
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