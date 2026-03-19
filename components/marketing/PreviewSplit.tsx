import BrowserMockup from "@/components/ui/BrowserMockup";

interface PreviewSplitProps {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  imageSrc: string;
  fakeUrl: string;
  imageAlt: string;
  /** When true, mockup is on the LEFT and text on the RIGHT */
  reversed?: boolean;
}

export default function PreviewSplit({
  eyebrow,
  title,
  body,
  bullets,
  imageSrc,
  fakeUrl,
  imageAlt,
  reversed = false,
}: PreviewSplitProps) {
  const textBlock = (
    <div className="flex flex-col justify-center">
      <p className="font-head text-[12px] font-bold uppercase tracking-[2px] text-[#E63946] mb-3">
        {eyebrow}
      </p>
      <h2 className="font-head text-2xl md:text-3xl font-black text-white leading-tight mb-4">
        {title}
      </h2>
      <p className="text-base text-[#9CA3AF] leading-relaxed mb-6 max-w-[420px]">
        {body}
      </p>
      <ul className="space-y-3">
        {bullets.map((bullet, i) => (
          <li key={i} className="flex items-center gap-3 text-sm text-white">
            <span className="w-2 h-2 rounded-full bg-[#E63946] flex-shrink-0" />
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  );

  const mockupBlock = (
    <div className="max-w-[700px] w-full">
      <BrowserMockup imageSrc={imageSrc} fakeUrl={fakeUrl} alt={imageAlt} />
    </div>
  );

  return (
    <section className="py-20 bg-transparent">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center">
          {reversed ? (
            <>
              <div className="lg:col-span-3 order-2 lg:order-1">
                {mockupBlock}
              </div>
              <div className="lg:col-span-2 order-1 lg:order-2">
                {textBlock}
              </div>
            </>
          ) : (
            <>
              <div className="lg:col-span-2 order-1">
                {textBlock}
              </div>
              <div className="lg:col-span-3 order-2">
                {mockupBlock}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
