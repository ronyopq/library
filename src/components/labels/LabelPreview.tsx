import Barcode from "react-barcode";
import { QRCodeSVG } from "qrcode.react";
import type { BookListItem } from "@shared/types";

interface LabelPreviewProps {
  book: BookListItem;
  libraryName: string;
  publicBaseUrl?: string;
  includeTitle: boolean;
  includeAuthor: boolean;
  includeDate: boolean;
  includeQr: boolean;
}

export const LabelPreview = ({
  book,
  libraryName,
  publicBaseUrl,
  includeTitle,
  includeAuthor,
  includeDate,
  includeQr
}: LabelPreviewProps) => {
  const qrBase = publicBaseUrl || window.location.origin;
  const qrValue = `${qrBase.replace(/\/$/, "")}/b/${book.publicCode}`;

  return (
    <article className="label-item rounded-lg border border-brand-200 bg-white p-2 text-[10px] text-ink-900">
      <p className="font-semibold text-[10px]">{libraryName}</p>
      {includeTitle ? <p className="line-clamp-2 font-medium">{book.title || "Untitled"}</p> : null}
      {includeAuthor ? <p className="line-clamp-1 text-[9px] text-ink-600">{book.authors.join(", ")}</p> : null}
      {includeDate ? <p className="text-[9px] text-ink-500">{new Date(book.dateAdded).toLocaleDateString()}</p> : null}

      <div className="mt-1 flex items-end justify-between gap-1">
        <Barcode
          value={book.accessionCode}
          height={28}
          width={0.9}
          displayValue={false}
          margin={0}
          background="transparent"
          lineColor="#173224"
        />
        {includeQr ? <QRCodeSVG value={qrValue} size={34} includeMargin={false} /> : null}
      </div>
      <p className="mt-1 text-center text-[9px]">{book.accessionCode}</p>
    </article>
  );
};