import { useEffect, useRef, useState } from "react";

/** Camera + leitura de EAN/UPC. Fica aberta para ler varios produtos em sequencia. */
export default function BarcodeScanner({ onCode, onClose, notice }: { onCode: (code: string) => void; onClose: () => void; notice: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const last = useRef({ code: "", at: 0 });
  const handler = useRef(onCode);
  handler.current = onCode;
  const [error, setError] = useState("");

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const { DecodeHintType, BarcodeFormat } = await import("@zxing/library");
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]);
        const reader = new BrowserMultiFormatReader(hints);
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          video.current!,
          (result) => {
            if (!result) return;
            const code = result.getText();
            const now = Date.now();
            if (code === last.current.code && now - last.current.at < 2500) return;
            last.current = { code, at: now };
            handler.current(code);
          },
        );
        if (cancelled) controls.stop();
        else stop = () => controls.stop();
      } catch {
        setError("Não consegui abrir a câmera. Libere a permissão de câmera no navegador.");
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return (
    <div className="scanner">
      <video ref={video} muted playsInline />
      <div className="scan-frame" />
      <div className="scan-top">
        <span>{notice || "Aponte para o código de barras"}</span>
        <button type="button" onClick={onClose}>Fechar</button>
      </div>
      {error && <p className="scan-error">{error}</p>}
    </div>
  );
}
