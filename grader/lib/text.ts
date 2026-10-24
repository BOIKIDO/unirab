// Report copy never shows em/en dashes: prompts forbid them for new content,
// and this scrubs anything already stored in the DB or slipped through by a
// model. Mid-sentence dashes become comma pauses; edge dashes are dropped.
export function stripEmDashes(text: string): string {
  return text
    .replace(/^\s*[—–]\s*/, '')
    .replace(/\s*[—–]\s*$/, '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/([,:;.!?])\s*,\s+/g, '$1 ')
}
