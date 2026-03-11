import { QRCodeSVG } from "qrcode.react";
import { BarcodeSvg } from "@/components/common/BarcodeSvg";

export interface LabelItem {
  id: string;
  bookId: number;
  accessionCode: string;
  publicCode: string;
  title?: string;
  authors: string[];
  dateAdded: string;
  copyCode: string;
  barcodeValue: string;
}

interface LabelPreviewProps {
  item: LabelItem;
  libraryName: string;
  publicBaseUrl?: string;
  includeTitle: boolean;
  includeAuthor: boolean;
  includeDate: boolean;
  includeQr: boolean;
}

export const LabelPreview = ({
  item,
  libraryName,
  publicBaseUrl,
  includeTitle,
  includeAuthor,
  includeDate,
  includeQr
}: LabelPreviewProps) => {
  const qrBase = publicBaseUrl || window.location.origin;
  const qrValue = `${qrBase.replace(/\/$/, "")}/b/${item.publicCode}`;

  return (
    <article className="label-item rounded-lg border border-app-border bg-white p-2 text-[10px] text-app-text">
      <p className="font-semibold text-[10px]">{libraryName}</p>
      {includeTitle ? <p className="line-clamp-2 font-medium">{item.title || "Untitled"}</p> : null}
      {includeAuthor ? <p className="line-clamp-1 text-[9px] text-app-muted">{item.authors.join(", ")}</p> : null}
      {includeDate ? <p className="text-[9px] text-app-muted">{new Date(item.dateAdded).toLocaleDateString()}</p> : null}

      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="min-w-0 flex-1 overflow-hidden">
          <BarcodeSvg value={item.barcodeValue} height={30} width={1.05} lineColor="#1f3f88" />
        </div>
        {includeQr ? <QRCodeSVG value={qrValue} size={34} includeMargin={false} /> : null}
      </div>
      <p className="mt-1 text-center text-[9px]">{item.copyCode}</p>
    </article>
  );
};
