/**
 * Compresses document / medical certificate photos on the client's device
 * using HTML5 Canvas before network transmission.
 * Reduces 5MB–10MB phone camera images down to ~60KB–90KB JPEGs.
 */
export async function compressMedicalImage(
  file: File,
  maxDimension = 1200,
  quality = 0.72
): Promise<{
  base64: string;
  originalSizeKb: number;
  compressedSizeKb: number;
  fileName: string;
}> {
  const originalSizeKb = Math.round(file.size / 1024);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image for compression"));
      img.onload = () => {
        let { width, height } = img;

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
          return reject(new Error("Browser 2D canvas context unavailable"));
        }

        // Clean white document background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const base64 = canvas.toDataURL("image/jpeg", quality);
        const compressedSizeKb = Math.round((base64.length * 3) / 4 / 1024);

        resolve({
          base64,
          originalSizeKb,
          compressedSizeKb,
          fileName: file.name,
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
