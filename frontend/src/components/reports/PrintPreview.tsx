import type {
  ReactNode,
} from "react";

import type {
  ReportOrientation,
} from "../../types/reports";

interface PrintPreviewProps {
  orientation: ReportOrientation;
  children: ReactNode;
}

export default function PrintPreview({
  orientation,
  children,
}: PrintPreviewProps) {
  return (
    <>
      <style>
        {`@media print { @page { size: A4 ${orientation}; margin: 12mm; } }`}
      </style>

      <div
        data-print-root
        data-orientation={orientation}
        className={`report-print-page mx-auto bg-white p-6 text-slate-950 shadow-sm sm:p-8 ${
          orientation === "portrait"
            ? "min-h-[297mm] max-w-[210mm]"
            : "min-h-[210mm] max-w-[297mm]"
        }`}
      >
        {children}
      </div>
    </>
  );
}
