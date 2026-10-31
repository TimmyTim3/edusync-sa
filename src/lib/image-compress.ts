/**
 * Compresses document / medical certificate photos on the client's device
 * using HTML5 Canvas before network transmission.
 * Reduces 5MB-10MB mobile camera photos down to ~80KB-120KB JPEG files.
 */

export interface CompressionResult {
  base64: string;
  originalSizeKb: number;
  compressedSizeKb: number;
}

export async function compressMedicalImage(
  file: File,
  maxDimension = 1200,
  quality = 0.72
): Promise<CompressionResult> {
  const originalSizeKb = Math.round(file.size / 1024);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Could not read image file"));

    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image data"));

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context unavailable"));
          return;
        }

        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64Content = compressedDataUrl.split(",")[1] ?? "";
        const compressedBytes = Math.round((base64Content.length * 3) / 4);
        const compressedSizeKb = Math.round(compressedBytes / 1024);

        resolve({
          base64: compressedDataUrl,
          originalSizeKb,
          compressedSizeKb,
        });
      };

      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
