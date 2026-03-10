import Cropper, { type Area } from "react-easy-crop";
import { useState } from "react";
import { getCroppedImageDataUrl } from "@/lib/crop";

interface CoverCropperProps {
  imageDataUrl: string;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
}

export const CoverCropper = ({ imageDataUrl, onCancel, onConfirm }: CoverCropperProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!area) return;
    setSaving(true);
    try {
      const dataUrl = await getCroppedImageDataUrl(imageDataUrl, area, 1200, 0.88);
      onConfirm(dataUrl);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h3 className="font-heading text-lg">Crop Cover Image</h3>
        <p className="text-sm text-app-muted">Select the best visible cover area before upload.</p>

        <div className="relative mt-3 h-72 overflow-hidden rounded-xl bg-slate-900">
          <Cropper
            image={imageDataUrl}
            crop={crop}
            zoom={zoom}
            aspect={2 / 3}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, areaPixels) => setArea(areaPixels)}
          />
        </div>

        <label className="mt-3 block text-sm text-app-muted">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="mt-2 w-full"
          />
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-app-border px-3 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="rounded-lg bg-app-primary px-3 py-2 text-sm text-white hover:bg-app-primary-strong disabled:opacity-60"
          >
            {saving ? "Processing..." : "Save Crop"}
          </button>
        </div>
      </div>
    </div>
  );
};