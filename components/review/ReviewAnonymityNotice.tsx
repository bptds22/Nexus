export default function ReviewAnonymityNotice() {
  return (
    <div
      className="flex items-start gap-3 rounded-lg p-3"
      style={{
        background: "rgba(59,130,246,0.05)",
        border: "1px solid rgba(59,130,246,0.15)",
      }}
    >
      <span className="text-[14px] shrink-0 mt-0.5">🔒</span>
      <p className="text-[13px] text-[#9CA3AF] leading-relaxed">
        Votre évaluation est anonyme. Le coach ne saura jamais que c&apos;est vous.
      </p>
    </div>
  );
}
