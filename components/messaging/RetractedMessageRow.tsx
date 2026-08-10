/* ═══════════════════════════════════════════════════════════════
   RetractedMessageRow — a retracted message renders NOT as a bubble
   but as a centered muted system row (italic, #6B7280). Applies to
   ALL conversation types (retraction is admin-level, all types).
   The content is already the literal marker ('Message retiré par Nexus'),
   overwritten server-side by admin_retract_message.
═══════════════════════════════════════════════════════════════ */

export default function RetractedMessageRow({ text }: { text?: string }) {
  return (
    <div className="flex justify-center py-1.5">
      <span className="text-[12px] italic text-[#6B7280]">
        {text || "Message retiré par Nexus"}
      </span>
    </div>
  );
}
