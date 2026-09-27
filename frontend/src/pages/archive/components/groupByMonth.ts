// pages/archive/components/groupByMonth.ts
import type { Attachment } from '@/types/archive';
import { formatYearMonth } from '@/utils/date';

/** 첨부를 연-월로 묶고 최신 달부터 정렬한다 (카카오톡 서랍과 같은 방식) */
export function groupByMonth(attachments: Attachment[]) {
  const groups = new Map<string, Attachment[]>();

  for (const attachment of [...attachments].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  )) {
    const key = formatYearMonth(attachment.uploadedAt);
    groups.set(key, [...(groups.get(key) ?? []), attachment]);
  }

  return [...groups.entries()].map(([month, items]) => ({ month, items }));
}
