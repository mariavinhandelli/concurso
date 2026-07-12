// app/(app)/profile/page.tsx
// Meu perfil — nome de exibição (user_metadata) + foto (Supabase Storage 'avatar').
// A foto passa por um passo de recorte (AvatarCropper) antes de subir.
'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { theme } from '@/lib/theme';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { useUI } from '@/components/layout/UIContext';
import { useUser } from '@/components/layout/UserContext';
import { AvatarCropper } from '@/components/features/profile/AvatarCropper';
import { PageContainer, PageHeader } from '@/components/ui/Page';

function isHttpsUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try { return new URL(url).protocol === 'https:'; } catch { return false; }
}

export default function ProfilePage() {
  const supabase = createClient();
  const { isMobile } = useUI();
  const { refreshUser } = useUser();
  const fileInput = useRef<HTMLInputElement>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Imagem escolhida aguardando recorte (object URL local).
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  // Garante que o object URL seja revogado quando o componente desmontar
  // ou quando o cropSrc mudar (ex: usuário escolhe outro arquivo).
  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data }) => {
        const u = data.user;
        if (u) {
          setUserId(u.id);
          setEmail(u.email ?? '');
          setName(u.user_metadata?.display_name ?? '');
          const rawUrl = u.user_metadata?.avatar_url;
          setAvatarUrl(isHttpsUrl(rawUrl) ? rawUrl : '');
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setMsg({ type: 'err', text: 'Erro ao carregar perfil. Recarregue a página.' });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flash(type: 'ok' | 'err', text: string) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3500);
  }

  // 1) Usuário escolhe um arquivo → validamos e abrimos o cropper (não sobe ainda).
  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) { flash('err', 'Selecione um arquivo de imagem.'); return; }
    if (file.size > 2 * 1024 * 1024) { flash('err', 'A imagem deve ter no máximo 2MB.'); return; }

    const url = URL.createObjectURL(file);
    setCropSrc(url);
    // libera o input para permitir reescolher o mesmo arquivo depois
    if (fileInput.current) fileInput.current.value = '';
  }

  // 2) Cropper confirma → sobe o Blob recortado (mesma lógica de Storage de antes).
  async function handleCroppedUpload(blob: Blob) {
    if (!userId) return;
    // fecha o cropper e revoga o object URL
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);

    setUploading(true);
    try {
      const path = `${userId}/avatar.jpg`;

      const { error: upErr } = await supabase.storage
        .from('avatar')
        .upload(path, blob, { upsert: true, cacheControl: '0', contentType: 'image/jpeg' });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('avatar').getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`; // fura o cache

      const { error: metaErr } = await supabase.auth.updateUser({
        data: { avatar_url: url },
      });
      if (metaErr) throw metaErr;

      setAvatarUrl(url);
      await refreshUser();
      flash('ok', 'Foto atualizada.');
    } catch (err) {
      flash('err', err instanceof Error ? err.message : 'Erro ao enviar a foto.');
    } finally {
      setUploading(false);
    }
  }

  function handleCancelCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  async function handleRemoveAvatar() {
    setUploading(true);
    try {
      if (userId) {
        await supabase.storage.from('avatar').remove([`${userId}/avatar.jpg`]).catch(() => {});
      }
      const { error } = await supabase.auth.updateUser({ data: { avatar_url: null } });
      if (error) throw error;
      setAvatarUrl('');
      await refreshUser();
      flash('ok', 'Foto removida.');
    } catch (err) {
      flash('err', err instanceof Error ? err.message : 'Erro ao remover foto.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveName() {
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: name.trim() },
      });
      if (error) throw error;
      await refreshUser();
      flash('ok', 'Perfil salvo.');
    } catch (err) {
      flash('err', err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  const initial = (name?.[0] ?? email?.[0] ?? '?').toUpperCase();

  if (loading) {
    return (
      <PageContainer width="narrow" style={{ minWidth: 0 }}>
        <div aria-label="Carregando perfil">
          <Skeleton width={180} height={28} />
          <Skeleton width={220} height={14} style={{ marginTop: 10, marginBottom: 24 }} />
          <Skeleton height={280} borderRadius={16} />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer width="narrow" style={{ minWidth: 0 }}>
      <PageHeader title="Meu perfil" subtitle="Sua foto e nome de exibição." />

      <div style={{ ...styles.card, padding: isMobile ? 20 : 28 }}>
        {/* Foto */}
        <section style={styles.section}>
          <div style={{ ...styles.avatarRow, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center' }}>
            <div style={styles.avatar}>
              {avatarUrl
                ? <img src={avatarUrl} alt="" loading="lazy" decoding="async" style={styles.avatarImg} />
                : <span style={styles.avatarInitial}>{initial}</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.label}>Foto de perfil</div>
              <div style={styles.hint}>JPG ou PNG, até 2MB.</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
                  {uploading ? 'Enviando…' : 'Trocar foto'}
                </Button>
                {avatarUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    disabled={uploading}
                    style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                  >
                    Remover foto
                  </Button>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                onChange={handlePick}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </section>

        <div style={styles.divider} />

        {/* Nome de exibição */}
        <section style={styles.section}>
          <label style={styles.label} htmlFor="display_name">Nome de exibição</label>
          <input
            id="display_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Como você quer ser chamado"
            style={styles.input}
            maxLength={40}
          />
        </section>

        {/* Email (read-only) */}
        <section style={styles.section}>
          <label style={styles.label}>Email</label>
          <input value={email} disabled style={{ ...styles.input, ...styles.inputDisabled }} />
          <div style={styles.hint}>O email é usado para login e não pode ser alterado aqui.</div>
        </section>

        <div style={styles.footer}>
          {msg && (
            <span
              role={msg.type === 'err' ? 'alert' : 'status'}
              aria-live="polite"
              style={{ fontSize: 13, fontWeight: 500, color: msg.type === 'ok' ? theme.ok : theme.danger }}
            >
              {msg.text}
            </span>
          )}
          <Button onClick={handleSaveName} disabled={saving} style={{ marginLeft: 'auto' }}>
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </div>
      </div>

      {cropSrc && (
        <AvatarCropper
          imageSrc={cropSrc}
          onCancel={handleCancelCrop}
          onConfirm={handleCroppedUpload}
        />
      )}
    </PageContainer>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 28 },
  section: { marginBottom: 4 },
  avatarRow: { display: 'flex', alignItems: 'center', gap: 20 },
  avatar: { width: 84, height: 84, borderRadius: '50%', background: theme.teal, display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0 },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitial: { color: theme.onTeal, fontWeight: 600, fontSize: 32 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: theme.ink, marginBottom: 8 },
  hint: { fontSize: 13, color: theme.inkFaint, marginTop: 6 },
  input: { width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 15, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  inputDisabled: { background: theme.bg, color: theme.inkSoft, cursor: 'not-allowed' },
  divider: { height: '0.5px', background: theme.line, margin: '22px 0' },
  footer: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 24, paddingTop: 20, borderTop: `0.5px solid ${theme.line}`, flexWrap: 'wrap' },
  muted: { color: theme.inkFaint, fontSize: 14 },
};