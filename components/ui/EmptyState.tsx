import { theme } from '@/lib/theme';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  body?: string;
  action?: { label: React.ReactNode; onClick: () => void };
  compact?: boolean;
}

export function EmptyState({ icon, title, body, action, compact = false }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', padding: compact ? '32px 16px' : '48px 24px', gap: 12,
    }}>
      <div style={{
        width: compact ? 44 : 64, height: compact ? 44 : 64,
        borderRadius: '50%', background: theme.tealBg,
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{
          fontSize: compact ? 15 : 17, fontWeight: 700, color: theme.ink,
          margin: 0, lineHeight: 1.3,
        }}>{title}</p>
        {body && (
          <p style={{
            fontSize: 14, color: theme.inkSoft, margin: 0,
            maxWidth: 360, lineHeight: 1.6,
          }}>{body}</p>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 4, padding: '10px 22px', borderRadius: theme.radiusSm,
            border: 'none', background: theme.primary, color: theme.onTeal,
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: theme.font,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
