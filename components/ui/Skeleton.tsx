'use client';

interface Props {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: Props) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: 'var(--line)',
        animation: 'skeleton-pulse 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  );
}
