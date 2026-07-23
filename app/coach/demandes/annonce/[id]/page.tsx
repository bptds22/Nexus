import { Suspense } from 'react';
import PageClient from './PageClient';

// Static export sentinel — Next 16 refuses to build a dynamic segment with an
// empty generateStaticParams under output:export. PageClient reads the actual
// broadcast id from the URL via useDynamicParam() at runtime.
export async function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

// Suspense wrapper required for a client page that uses reactive param hooks
// during SSR.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageClient />
    </Suspense>
  );
}
