'use client';

import dynamic from 'next/dynamic';
const ArtValidation = dynamic(() => import('@/components/ArtValidation'), { ssr: false });
export default function ArtValidationPage() {
  return <ArtValidation />;
}
