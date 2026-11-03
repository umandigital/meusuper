import { useEffect, useRef, useState } from "react";

type Kind = "product" | "qr";

/** Leitor nativo do Android/Chrome (rapido e com bom foco); nao existe em todo navegador. */
interface NativeDetector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: { new (opts: { formats: string[] }): NativeDetector };
  }
}

/** Texto do erro da camera, com o que fazer em cada caso. */
function cameraMessage(e: unknown): string {
  const name = (e as { name?: string })?.name ?? "";
  if (!navigator.mediaDevices?.getUserMedia) return "A câmera só funciona em página segura (https). Abra o endereço do app pelo navegador.";
  if (name === "NotAllowedError" || name === "SecurityError") return "A câmera está bloqueada para este app. Toque no cadeado ao lado do endereço (ou em Configurações do app > Permissões), libere a Câmera e abra o leitor de novo.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Não encontrei uma câmera neste aparelho.";
  if (name === "NotReadableError" || name === "AbortError") return "A câmera está em uso por outro app. Feche o outro app e tente de novo.";
  return "Não consegui abrir a câmera. Feche o leitor e abra de novo.";
}

async function openCamera(): Promise<MediaStream> {
  // resolucao maior deixa o codigo nitido; se o aparelho recusar, cai para o que ele tiver
  const tries: MediaStreamConstraints[] = [
    { video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
    { video: { facingMode: { ideal: "environment" } }, audio: false },
    { video: true, audio: false },
  ];
  let last: unknown;
  for (const c of tries) {
    try {
      return await navigator.mediaDevices.getUserMedia(c);
    } catch (e) {
      last = e;
      const n = (e as { name?: string }).name;
      if (n === "NotAllowedError" || n === "SecurityError" || n === "NotReadableError") break;
    }
  }
  throw last;
}

/** Foco continuo (quando o aparelho oferece): sem isso muitos celulares ficam com o codigo desfocado. */
async function keepFocus(track: MediaStreamTrack) {
  try {
    const caps = track.getCapabilities?.() as { focusMode?: string[] } | undefined;
    if (caps?.focusMode?.includes("continuous")) await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] });
  } catch {
    /* sem foco ajustavel: segue com o padrao */
  }
}

/** Camera + leitura de EAN/UPC ou QR. Fica aberta para ler varios produtos em sequencia. */
export default function BarcodeScanner({ onCode, onClose, notice, kind = "product" }: { onCode: (code: string) => void; onClose: () => void; notice: string; kind?: Kind }) {
  const video = useRef<HTMLVideoElement>(null);
  const last = useRef({ code: "", at: 0 });
  const handler = useRef(onCode);
  handler.current = onCode;
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | undefined;
    let timer: number | undefined;
    let stopZxing: (() => void) | undefined;

    const found = (code: string) => {
      const now = Date.now();
      if (code === last.current.code && now - last.current.at < 2500) return;
      last.current = { code, at: now };
      handler.current(code);
    };

    (async () => {
      try {
        stream = await openCamera();
        if (cancelled) return;
        const el = video.current!;
        el.srcObject = stream;
        void keepFocus(stream.getVideoTracks()[0]);
        await el.play();

        if (window.BarcodeDetector) {
          const detector = new window.BarcodeDetector({ formats: kind === "qr" ? ["qr_code"] : ["ean_13", "ean_8", "upc_a", "upc_e"] });
          const tick = async () => {
            if (cancelled) return;
            try {
              if (el.readyState >= 2) {
                const hits = await detector.detect(el);
                if (hits[0]?.rawValue) found(hits[0].rawValue);
              }
            } catch {
              /* quadro ruim: tenta no proximo */
            }
            timer = window.setTimeout(tick, 120);
          };
          void tick();
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const { DecodeHintType, BarcodeFormat } = await import("@zxing/library");
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, kind === "qr" ? [BarcodeFormat.QR_CODE] : [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]);
          hints.set(DecodeHintType.TRY_HARDER, true);
          const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });
          const controls = await reader.decodeFromStream(stream, el, (result) => {
            if (result) found(result.getText());
          });
          if (cancelled) controls.stop();
          else stopZxing = () => controls.stop();
        }
      } catch (e) {
        if (!cancelled) setError(cameraMessage(e));
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stopZxing?.();
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="scanner">
      <video ref={video} muted playsInline autoPlay />
      <div className={`scan-frame${kind === "qr" ? " qr" : ""}`} />
      <div className="scan-top">
        <span>{notice || (kind === "qr" ? "Aponte para o QR Code da nota" : "Aponte para o código de barras")}</span>
        <button type="button" onClick={onClose}>Fechar</button>
      </div>
      {error && <p className="scan-error">{error}</p>}
    </div>
  );
}
