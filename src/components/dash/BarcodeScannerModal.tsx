import React, { useEffect, useRef, useState } from "react";
import { Camera, X, AlertCircle, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
}

export function BarcodeScannerModal({ isOpen, onClose, onScan, title = "Scan Textbook Barcode" }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");

  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const startCamera = async () => {
    setErrorMsg(null);
    setHasPermission(null);
    stopCamera();

    if (!navigator?.mediaDevices?.getUserMedia) {
      setErrorMsg("Camera access is not supported by this browser. Use the photo upload or manual input below.");
      setHasPermission(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setHasPermission(true);
      setIsScanning(true);
    } catch (err: any) {
      setHasPermission(false);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setErrorMsg("Camera permission was denied. Please allow camera access in your browser settings.");
      } else {
        setErrorMsg(err.message || "Unable to start camera stream.");
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isScanning) return;

    let active = true;
    let timer: NodeJS.Timeout | null = null;

    const detectLoop = async () => {
      if (!active || !videoRef.current) return;

      if ("BarcodeDetector" in window) {
        try {
          const detector = new (window as any).BarcodeDetector({
            formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e"],
          });
          const detected = await detector.detect(videoRef.current);
          if (detected && detected.length > 0 && detected[0]?.rawValue) {
            const code = detected[0].rawValue.trim();
            playBeep();
            toast.success(`Scanned: ${code}`);
            onScan(code);
            onClose();
            return;
          }
        } catch {
          // Skip frame on fast movement
        }
      }

      if (active) {
        timer = setTimeout(detectLoop, 250);
      }
    };

    timer = setTimeout(detectLoop, 400);

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, isScanning]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if ("BarcodeDetector" in window) {
      try {
        const imageBitmap = await createImageBitmap(file);
        const detector = new (window as any).BarcodeDetector({
          formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e"],
        });
        const detected = await detector.detect(imageBitmap);
        if (detected && detected.length > 0 && detected[0]?.rawValue) {
          const code = detected[0].rawValue.trim();
          playBeep();
          toast.success(`Detected barcode: ${code}`);
          onScan(code);
          onClose();
          return;
        } else {
          toast.error("No clear barcode found in the photo. Please try again or type the code.");
        }
      } catch (err: any) {
        toast.error("Could not scan photo: " + (err.message || "Unsupported format"));
      }
    } else {
      toast.info("Native photo barcode detection is not supported on this browser. Please type the barcode.");
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    onScan(manualCode.trim().toUpperCase());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-card border border-border shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-border p-3.5 bg-muted/40">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`h-full w-full object-cover transition-opacity duration-300 ${isScanning ? "opacity-100" : "opacity-0"}`}
          />

          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-3/4 h-2/3 border-2 border-emerald-400/80 rounded-xl shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                <div className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse top-1/2 -translate-y-1/2" />
                <span className="absolute bottom-2 inset-x-0 text-center text-[10px] font-medium tracking-wide text-white/90 drop-shadow">
                  Align textbook barcode inside box
                </span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="absolute inset-0 p-4 bg-background/95 flex flex-col items-center justify-center text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-amber-500" />
              <p className="text-xs text-muted-foreground max-w-xs">{errorMsg}</p>
              <button
                onClick={startCamera}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Try Camera Again
              </button>
            </div>
          )}
        </div>

        <div className="p-4 space-y-3 bg-card border-t border-border">
          <div className="flex items-center justify-between gap-2 text-xs">
            <label className="flex-1 cursor-pointer flex items-center justify-center gap-1.5 py-2 px-3 border border-border rounded-lg bg-muted/30 hover:bg-muted font-medium transition-colors text-center">
              <Upload className="h-3.5 w-3.5" /> Take / Upload Photo
              <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Or type barcode here..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 px-3 py-1.5 border border-border rounded-lg text-xs bg-background font-mono"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              Use
            </button>
          </form>
        </div>
      </div>
    </div>
  );
    }
              
