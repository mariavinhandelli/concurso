// app/reset-password/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { FocaliIcon } from '@/app/login/page';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  const [sessaoValida, setSessaoValida] = useState<boolean | null>(null);
  const redirectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimeout.current) clearTimeout(redirectTimeout.current);
    };
  }, []);

  // Ao chegar pelo link do e-mail, o Supabase cria a sessão de recuperação.
  // getUser() verifica o token no servidor — mais seguro que getSession().
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setSessaoValida(!!data.user);
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
      redirectTimeout.current = setTimeout(() => {
        router.push('/login');
        router.refresh();
      }, 1500);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <form
          style={{ width: '100%' }}
          onSubmit={(event) => {
            event.preventDefault();
            void handleReset();
          }}
        >
          <div style={styles.brand}>
            <FocaliIcon size={44} idPrefix="rp" />
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
              <div style={{ marginBottom: 14 }}>
                <label htmlFor="new-password" style={styles.label}>Nova senha</label>
                <Input
                  id="new-password"
                  name="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="mínimo 6 caracteres"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  icon={<Lock size={16} strokeWidth={1.8} />}
                  style={styles.input}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label htmlFor="confirm-password" style={styles.label}>Confirmar nova senha</label>
                <Input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="repita a senha"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  icon={<Lock size={16} strokeWidth={1.8} />}
                  style={styles.input}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                onMouseEnter={() => setBtnHover(true)}
                onMouseLeave={() => setBtnHover(false)}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                  background: loading
                    ? 'var(--muted)'
                    : btnHover ? 'var(--gradient-cta-hover)' : 'var(--gradient-cta)',
                  color: loading ? 'var(--ink-faint)' : 'var(--on-cta)', fontSize: 15, fontWeight: 600,
                  cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'filter 150ms cubic-bezier(.4,0,.2,1)',
                }}
              >
                {loading ? 'Aguarde…' : (
                  <>
                    Redefinir senha
                    <ArrowRight size={16} strokeWidth={2.2} />
                  </>
                )}
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
    fontFamily: 'var(--font-poppins), Inter, Arial, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 460,
    background: 'var(--card)',
    borderRadius: 24,
    boxShadow: 'var(--shadow-modal)',
    padding: '40px 48px',
  },
  brand: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    margin: '0 0 6px',
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--ink)',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    margin: '0 0 28px',
    fontSize: 13,
    color: 'var(--ink-soft)',
    textAlign: 'center',
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--ink-soft)',
    marginBottom: 6,
  },
  input: {
    padding: '13px 14px 13px 42px',
    borderRadius: 12,
    border: '1.5px solid var(--line-strong)',
  },
  feedback: {
    fontSize: 13,
    marginTop: 16,
    textAlign: 'center',
    padding: '10px 14px',
    borderRadius: 10,
    lineHeight: 1.5,
  },
};
