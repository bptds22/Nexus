import { Suspense } from 'react';
import PageClient from './PageClient';

// Static export sentinel — Next 16 + Turbopack refuses to build a dynamic
// segment with an empty generateStaticParams. PageClient reads the actual
// id from window.location via useParams() at runtime.
export async function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

// Suspense wrapper is required for any PageClient that uses useSearchParams,
// useParams reactive hooks, or other suspending APIs during SSR.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageClient />
    </Suspense>
  );
}
