'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useGame } from '@/store/game';
import type { Player } from '@/engine/types';

export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => {
    const done = () => setH(true);
    if (useGame.persist.hasHydrated()) done();
    const unsub = useGame.persist.onFinishHydration(done);
    return unsub;
  }, []);
  return h;
}

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.9.8 3.1 2.5 3.5 5.2" />
    </>
  ),
  play: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5l6 3.5-6 3.5z" />
    </>
  ),
  swap: <path d="M4 8h14l-3-3M20 16H6l3 3" />,
  trophy: <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" />,
  back: <path d="M15 5l-7 7 7 7" />,
};

export function Icon({ name, size = 22 }: { name: keyof typeof ICONS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const TABS = [
  { href: '/domov', label: 'Domov', icon: 'home' },
  { href: '/kader', label: 'Kader', icon: 'users' },
  { href: '/tekma', label: 'Tekma', icon: 'play' },
  { href: '/liga', label: 'Liga', icon: 'trophy' },
  { href: '/prestopi', label: 'Prestopi', icon: 'swap' },
];

export function Shell({ children, nav = true }: { children: React.ReactNode; nav?: boolean }) {
  const hydrated = useHydrated();
  const game = useGame((s) => s.game);
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (hydrated && !game && path !== '/nova') router.replace('/nova');
  }, [hydrated, game, path, router]);
  if (!hydrated) return <div className="app" />;
  if (!game && path !== '/nova') return <div className="app" />;
  return (
    <div className="app">
      {children}
      {nav && game && (
        <nav className="nav">
          <div className="nav-in">
            {TABS.map((t) => (
              <Link key={t.href} href={t.href} className={`tab ${path.startsWith(t.href) ? 'on' : ''}`}>
                <Icon name={t.icon} />
                {t.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="muted" style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 13, height: 32 }}>
      <Icon name="back" size={18} />
      {label}
    </Link>
  );
}

export const ovrColor = (o: number) => (o >= 65 ? 'var(--accent)' : o >= 55 ? 'var(--text)' : 'var(--muted)');
export const attrColor = (v: number) => (v >= 15 ? 'var(--accent)' : v >= 11 ? 'var(--gold)' : 'var(--orange)');
export const formColor = (f: number) => (f >= 0.6 ? 'var(--good)' : f <= -0.6 ? 'var(--orange)' : 'var(--gold)');

export const POS_LABEL: Record<Player['pos'], string> = { C: 'C', LW: 'LK', RW: 'DK', D: 'B', G: 'G' };
export const POS_FULL: Record<Player['pos'], string> = { C: 'Center', LW: 'Levo krilo', RW: 'Desno krilo', D: 'Branilec', G: 'Golman' };

export function Bar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="bar">
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}
