'use client';

import dynamic from 'next/dynamic';

// The whole app reads sessionStorage and boots Phaser, so it renders client-side only.
const App = dynamic(() => import('@/components/App'), { ssr: false });

export default function Home() {
  return <App />;
}
