interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image"));
    image.src = url;
  });

export const getCroppedImageDataUrl = async (
  imageSrc: string,
  crop: Area,
  maxWidth = 1200,
  quality = 0.88
): Promise<string> => {
  const image = await createImage(imageSrc);

  const scale = Math.min(1, maxWidth / crop.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(crop.width * scale);
  canvas.height = Math.round(crop.height * scale);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is unavailable");
  }

  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas.toDataURL("image/jpeg", quality);
};

export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });