import { Suspense } from "react";
import PageClient from "./PageClient";

// Static export sentinel — Next 16 refuses a dynamic segment with an empty
// generateStaticParams. PageClient reads the id at runtime via useDynamicParam.
export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageClient />
    </Suspense>
  );
}
