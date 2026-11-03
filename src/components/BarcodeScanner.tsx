import { useEffect, useRef, useState } from "react";

type Kind = "product" | "qr";

/** Leitor nativo do Android/Chrome (rapido e com bom foco); nao existe em todo navegador. */
interface NativeDetector {
  detect(source: HTMLVideoElement | ImageBitmap): Promise<{ rawValue: string }[]>;
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

async function openCamera(deviceId: string | null): Promise<MediaStream> {
  // resolucao maior deixa o codigo nitido; se o aparelho recusar, cai para o que ele tiver
  const which: MediaTrackConstraints = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } };
  const tries: MediaStreamConstraints[] = [
    { video: { ...which, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
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

const formatsOf = (kind: Kind) => (kind === "qr" ? ["qr_code"] : ["ean_13", "ean_8", "upc_a", "upc_e"]);

/** Le o codigo de uma FOTO (tirada pelo app de camera do celular, que foca bem). Devolve o texto ou null. */
async function decodePhoto(file: File, kind: Kind): Promise<string | null> {
  if (window.BarcodeDetector) {
    try {
      const hits = await new window.BarcodeDetector({ formats: formatsOf(kind) }).detect(await createImageBitmap(file));
      if (hits[0]?.rawValue) return hits[0].rawValue;
    } catch {
      /* tenta o outro leitor */
    }
  }
  const { BrowserMultiFormatReader } = await import("@zxing/browser");
  const { DecodeHintType, BarcodeFormat } = await import("@zxing/library");
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, kind === "qr" ? [BarcodeFormat.QR_CODE] : [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const url = URL.createObjectURL(file);
  try {
    return (await new BrowserMultiFormatReader(hints).decodeFromImageUrl(url)).getText();
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Camera + leitura de EAN/UPC ou QR. Fica aberta para ler varios produtos em sequencia. */
export default function BarcodeScanner({ onCode, onClose, notice, kind = "product" }: { onCode: (code: string) => void; onClose: () => void; notice: string; kind?: Kind }) {
  const video = useRef<HTMLVideoElement>(null);
  const last = useRef({ code: "", at: 0 });
  const handler = useRef(onCode);
  handler.current = onCode;
  const [error, setError] = useState("");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [zoom, setZoom] = useState<{ min: number; max: number; step: number; value: number } | null>(null);
  const [photoMsg, setPhotoMsg] = useState("");
  const track = useRef<MediaStreamTrack>();

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoMsg("Lendo a foto…");
    const code = await decodePhoto(file, kind);
    if (code) {
      setPhotoMsg("");
      last.current = { code, at: Date.now() };
      handler.current(code);
    } else {
      setPhotoMsg("Não consegui ler a foto. Tire de novo, enquadrando só o código, bem de frente e com boa luz.");
    }
  }

  /** Toque na imagem: pede ao aparelho para focar de novo. */
  async function refocus() {
    const t = track.current;
    try {
      await t?.applyConstraints({ advanced: [{ focusMode: "single-shot" } as MediaTrackConstraintSet] });
      await keepFocus(t!);
    } catch {
      /* aparelho sem controle de foco */
    }
  }

  function nextCamera() {
    if (cams.length < 2) return;
    const current = track.current?.getSettings().deviceId;
    const i = cams.findIndex((c) => c.deviceId === current);
    setDeviceId(cams[(i + 1) % cams.length].deviceId);
  }

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
        stream = await openCamera(deviceId);
        if (cancelled) return;
        const el = video.current!;
        el.srcObject = stream;
        const t = stream.getVideoTracks()[0];
        track.current = t;
        void keepFocus(t);
        const caps = t.getCapabilities?.() as { zoom?: { min: number; max: number; step?: number } } | undefined;
        setZoom(caps?.zoom ? { min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1, value: Number((t.getSettings() as { zoom?: number }).zoom ?? caps.zoom.min) } : null);
        await el.play();
        // com a permissao dada, os nomes das cameras aparecem: guarda as traseiras para poder trocar (a ultra-wide nao foca)
        const all = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
        const back = all.filter((d) => /back|rear|traseira|environment/i.test(d.label));
        if (!cancelled) setCams(back.length > 1 ? back : all.length > 1 ? all : []);

        if (window.BarcodeDetector) {
          const detector = new window.BarcodeDetector({ formats: formatsOf(kind) });
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
  }, [deviceId]);

  return (
    <div className="scanner">
      <video ref={video} muted playsInline autoPlay onClick={() => void refocus()} />
      <div className={`scan-frame${kind === "qr" ? " qr" : ""}`} />
      <div className="scan-top">
        <span>{notice || (kind === "qr" ? "Aponte para o QR Code. Se não ler, toque em Tirar foto" : "Aponte para o código de barras")}</span>
        <button type="button" onClick={onClose}>Fechar</button>
      </div>
      {error && <p className="scan-error">{error}</p>}
      <div className="scan-bottom">
        {photoMsg && <p role="status">{photoMsg}</p>}
        {zoom && zoom.max > zoom.min && (
          <label className="scan-zoom">Zoom
            <input type="range" min={zoom.min} max={zoom.max} step={zoom.step} value={zoom.value} onChange={(e) => {
              const v = Number(e.target.value);
              setZoom({ ...zoom, value: v });
              void track.current?.applyConstraints({ advanced: [{ zoom: v } as MediaTrackConstraintSet] });
            }} />
          </label>
        )}
        <div className="scan-actions">
          <label className="photo-btn">
            Tirar foto do {kind === "qr" ? "QR Code" : "código"}
            <input type="file" accept="image/*" capture="environment" onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {cams.length > 1 && <button type="button" onClick={nextCamera}>Trocar câmera</button>}
        </div>
      </div>
    </div>
  );
}
