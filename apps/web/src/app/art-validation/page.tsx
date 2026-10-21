import { notFound } from 'next/navigation';
import ArtValidation from '@/components/ArtValidationLoader';

export const dynamic = 'force-dynamic';
export default function ArtValidationPage() {
  if (process.env.NODE_ENV === 'production' && process.env.ART_VALIDATION_ENABLED !== 'true')
    notFound();
  return <ArtValidation />;
}
