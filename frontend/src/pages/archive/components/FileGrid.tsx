// pages/archive/components/FileGrid.tsx
import FileCard from '@/pages/archive/components/FileCard';
import MonthSection from '@/pages/archive/components/MonthSection';
import { groupByMonth } from '@/pages/archive/components/groupByMonth';
import type { Attachment } from '@/types/archive';

interface FileGridProps {
  files: Attachment[];
}

/** 파일 모아보기. 연-월로 묶어 2열 카드로 보여준다 */
export default function FileGrid({ files }: FileGridProps) {
  if (files.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">주고받은 파일이 없어요</p>
    );
  }

  return (
    <div className="space-y-6">
      {groupByMonth(files).map(({ month, items }) => (
        <MonthSection key={month} month={month}>
          <ul className="grid grid-cols-2 gap-3">
            {items.map((file) => (
              <li key={file.id}>
                <FileCard file={file} />
              </li>
            ))}
          </ul>
        </MonthSection>
      ))}
    </div>
  );
}
