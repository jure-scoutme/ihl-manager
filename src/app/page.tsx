'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/store/game';
import { useHydrated } from '@/components/ui';

export default function Home() {
  const hydrated = useHydrated();
  const game = useGame((s) => s.game);
  const router = useRouter();
  useEffect(() => {
    if (hydrated) router.replace(game ? '/domov' : '/nova');
  }, [hydrated, game, router]);
  return <div className="app" />;
}
