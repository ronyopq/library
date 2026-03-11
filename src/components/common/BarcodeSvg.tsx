import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeSvgProps {
  value?: string;
  className?: string;
  height?: number;
  width?: number;
  lineColor?: string;
}

export const BarcodeSvg = ({
  value,
  className,
  height = 48,
  width = 1.25,
  lineColor = "#1f2937"
}: BarcodeSvgProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [failed, setFailed] = useState(false);
  const sanitized = useMemo(() => (value ?? "").trim(), [value]);

  useEffect(() => {
    if (!svgRef.current || !sanitized) {
      return;
    }

    try {
      JsBarcode(svgRef.current, sanitized, {
        format: "CODE128",
        displayValue: false,
        margin: 0,
        height,
        width,
        lineColor
      });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [height, lineColor, sanitized, width]);

  if (!sanitized) {
    return <p className="text-[10px] text-app-muted">Barcode not available</p>;
  }

  if (failed) {
    return <p className="text-[10px] text-app-muted">Barcode render failed for {sanitized}</p>;
  }

  return (
    <div className={className}>
      <svg ref={svgRef} className="block h-auto max-w-full" />
    </div>
  );
};
