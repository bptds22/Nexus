import Image from "next/image";

interface BrowserMockupProps {
  imageSrc: string;
  fakeUrl: string;
  alt: string;
  flat?: boolean;
}

export default function BrowserMockup({
  imageSrc,
  fakeUrl,
  alt,
  flat = false,
}: BrowserMockupProps) {
  return (
    <div className="relative w-full group">
      {/* Red glow behind the mockup */}
      {!flat && (
        <div className="absolute -inset-6 bg-[#E63946]/20 blur-[60px] rounded-3xl pointer-events-none" />
      )}

      <div
        className={
          flat
            ? "relative rounded-xl overflow-hidden border border-[#2A2D35]/60 bg-[#0f1117]"
            : "relative rounded-2xl overflow-hidden border border-[#2A2D35]/50 bg-[#0f1117] shadow-[0_8px_40px_rgba(0,0,0,0.5),0_0_0_1px_rgba(230,57,70,0.06)]"
        }
      >
        {/* Minimal URL bar — small so the screenshot is the star */}
        <div className="flex items-center gap-2 px-3 py-2 bg-[#13161d] border-b border-[#1e2128]">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]/80" />
          </div>
          <div className="flex-1 ml-1.5 bg-[#0a0d14] rounded-md px-2.5 py-0.5">
            <span className="text-[10px] text-[#4B5563] font-mono truncate block">
              {fakeUrl}
            </span>
          </div>
        </div>

        {/* Screenshot — contain so nothing gets clipped */}
        <div className="relative w-full bg-[#0a0d14]">
          <Image
            src={imageSrc}
            alt={alt}
            width={1400}
            height={900}
            className="w-full h-auto block"
            sizes="(max-width: 768px) 100vw, 700px"
          />
        </div>

        {/* Subtle bottom fade so the image doesn't hard-cut */}
        {!flat && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0a0d14]/60 to-transparent pointer-events-none" />
        )}
      </div>

    </div>
  );
}
