import { useCallback, useRef, useState } from "react";
import { iterateNdjson } from "./ndjsonReader";
import { useLiveStream } from "./useLiveStream";
import { useToneEngine } from "./useToneEngine";
import { Visualizer } from "./Visualizer";
import type { NdjsonEvent } from "./types";

export default function App() {
  const { ready, start, lastNote, status, handleLine } = useToneEngine();
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onEvent = useCallback(
    (ev: NdjsonEvent) => {
      handleLine(JSON.stringify(ev));
    },
    [handleLine]
  );

  const live = useLiveStream(onEvent, liveEnabled);

  const startExperience = useCallback(async () => {
    await start();
    setLiveEnabled(true);
    setShowHelp(false);
  }, [start]);

  const onFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      for await (const ev of iterateNdjson(text)) {
        onEvent(ev);
      }
    },
    [onEvent]
  );

  const displayFrame = live.lastFrame ?? status.lastFrame;

  return (
    <div className="app-shell">
      <Visualizer frame={displayFrame} gestureFlash={live.lastGesture} />

      <div className="overlay-ui">
        {!ready ? (
          <>
            <button type="button" className="cta" onClick={() => void startExperience()}>
              Iniciar experiência
            </button>
            {showHelp && (
              <section className="help-card overlay-help">
                <h2>Como tocar (scale_gate)</h2>
                <table className="mapping-table">
                  <tbody>
                    <tr>
                      <td>Palma aberta (dir.)</td>
                      <td>Segura a nota (sustain)</td>
                    </tr>
                    <tr>
                      <td>Punho (dir.)</td>
                      <td>Solta a nota</td>
                    </tr>
                    <tr>
                      <td>Mão dir. vertical (Y)</td>
                      <td>Faixa da escala (zonas do YAML)</td>
                    </tr>
                    <tr>
                      <td>Vitória V (dir.)</td>
                      <td>Segure V: volume 0–100% pela distância (2 mãos)</td>
                    </tr>
                    <tr>
                      <td>Palma + V</td>
                      <td>Gate da palma permanece; alterne palma (nota) e V (volume)</td>
                    </tr>
                    <tr>
                      <td>Apontar (dir.)</td>
                      <td>Acento na nota atual (gate aberto)</td>
                    </tr>
                    <tr>
                      <td>Afastar mãos (com V)</td>
                      <td>Calibra 0–100% na sessão; soltar V mantém o volume</td>
                    </tr>
                    <tr>
                      <td>Polegar +/- (esq.)</td>
                      <td>Oitava</td>
                    </tr>
                  </tbody>
                </table>
              </section>
            )}
          </>
        ) : (
          <div className="hud">
            <div className="badges">
              <span className={`badge left ${status.leftOn ? "on" : ""}`}>Esq</span>
              <span className={`badge right ${status.rightOn ? "on" : ""}`}>Dir</span>
              <span className={`badge gate ${status.gateOpen ? "on" : ""}`}>
                GATE {status.gateOpen ? "ON" : "off"}
              </span>
              <span className={`badge vol ${status.volumeActive ? "on" : ""}`}>
                VOL {status.volumeActive ? "ON" : "off"}
              </span>
            </div>
            {status.lastFrame?.right.presence && (
              <div className="zone-strip" aria-hidden>
                <div
                  className="zone-marker"
                  style={{
                    top: `${(1 - (status.lastFrame.right.pitch_norm ?? 0.5)) * 100}%`,
                  }}
                />
              </div>
            )}
            <p className="hud-note">
              <strong>{status.currentNote}</strong>
              <span className="dim">
                {" "}
                · {status.scaleName} · grau {status.scaleDegree + 1}/
                {status.scaleSize} · {status.rightGesture}
              </span>
            </p>
            <p className="hud-line">
              {live.connected ? (
                <span className="ok">● Ao vivo</span>
              ) : live.connecting ? (
                <span>○ Conectando…</span>
              ) : (
                <span className="warn">
                  ○ Rode <code>hand-gestures --musical --pick-camera</code>
                </span>
              )}
            </p>
            <p className="hud-line dim">
              {lastNote} · Vol{" "}
              {(status.effectiveVolume * 100).toFixed(
                status.volumeActive ? 1 : 0
              )}
              % · {status.playMode}
            </p>
            <button
              type="button"
              className="link-btn"
              onClick={() => setShowHelp((v) => !v)}
            >
              {showHelp ? "Ocultar ajuda" : "Como tocar"}
            </button>
            {showHelp && (
              <p className="hint compact">
                Palma = nota · Punho = solta · Y = faixa · Segure V = volume
              </p>
            )}
            <button
              type="button"
              className="link-btn"
              onClick={() => setShowDebug((v) => !v)}
            >
              {showDebug ? "Ocultar debug" : "Debug: arquivo"}
            </button>
            {showDebug && (
              <>
                <button type="button" onClick={() => fileRef.current?.click()}>
                  Carregar events.ndjson
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".ndjson,.jsonl,.json"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onFile(f);
                  }}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
