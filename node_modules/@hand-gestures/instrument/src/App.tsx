import { useCallback, useEffect, useRef, useState } from "react";
import type { NdjsonEvent } from "@hand-gestures/protocol";

import { getBackendMode } from "./backendMode";
import { notifyInstrumentReady } from "./embed";
import { iterateNdjson } from "./ndjsonReader";
import { useAudioEngine } from "./useAudioEngine";
import { useCamera } from "./useCamera";
import { useInstrumentLoop } from "./useInstrumentLoop";
import { useLiveStream } from "./useLiveStream";
import { VideoMirror } from "./VideoMirror";
import { Visualizer } from "./Visualizer";

const backendMode = getBackendMode();

export default function App() {
  const { ready, start, lastNote, status, handleLine, handleEvent } =
    useAudioEngine();
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sonicPanelRef = useRef<HTMLElement>(null);

  const camera = useCamera();
  const useBrowser = backendMode === "browser";
  const useWs = backendMode === "ws";

  const loop = useInstrumentLoop(
    camera.videoRef,
    liveEnabled && useBrowser && camera.active,
    handleLine
  );

  const onWsEvent = useCallback(
    (ev: NdjsonEvent) => handleEvent(ev),
    [handleEvent]
  );
  const live = useLiveStream(onWsEvent, liveEnabled && useWs);

  const displayFrame =
    (useWs ? live.lastFrame : status.lastFrame) ?? status.lastFrame;
  const gestureFlash = useWs ? live.lastGesture : loop.lastGesture;

  const startExperience = useCallback(async () => {
    await start();
    if (useBrowser) {
      await camera.start();
    }
    setLiveEnabled(true);
    setShowHelp(false);
    notifyInstrumentReady();
  }, [start, camera, useBrowser]);

  useEffect(() => {
    if (backendMode !== "demo" || !liveEnabled) return;
    void (async () => {
      try {
        const res = await fetch("/fixtures/demo.ndjson");
        if (!res.ok) return;
        const text = await res.text();
        for await (const ev of iterateNdjson(text)) {
          handleEvent(ev);
        }
      } catch {
        /* demo opcional */
      }
    })();
  }, [liveEnabled, handleEvent]);

  const connected = useWs ? live.connected : camera.active && loop.running;
  const modeLabel =
    backendMode === "browser"
      ? "browser"
      : backendMode === "ws"
        ? "ws dev"
        : "demo";

  const cameraVisible = useBrowser && camera.active;

  return (
    <div className="app-shell instrument-layout">
      <section className="camera-panel" aria-label="Câmera">
        {useBrowser ? (
          <VideoMirror videoRef={camera.videoRef} visible={cameraVisible} />
        ) : (
          <div className="camera-placeholder">
            {useWs
              ? "Modo WebSocket — câmera no processo Python. A grade sonora reflete os frames recebidos."
              : "Modo demo — reprodução de fixture. Inicie com câmera no navegador (sem ?backend=ws)."}
          </div>
        )}
      </section>

      <section
        className="sonic-panel"
        ref={sonicPanelRef}
        aria-label="Grade sonora"
      >
        <Visualizer
          containerRef={sonicPanelRef}
          frame={displayFrame}
          gestureFlash={gestureFlash}
        />

        {ready && status.lastFrame?.right.presence && (
          <div className="zone-strip" aria-hidden>
            <div
              className="zone-marker"
              style={{
                top: `${(1 - (status.lastFrame.right.pitch_norm ?? 0.5)) * 100}%`,
              }}
            />
          </div>
        )}

        {ready && (
          <div className="hud-dock">
            <div className="hud">
              <div className="badges">
                <span className={`badge left ${status.leftOn ? "on" : ""}`}>
                  Esq
                </span>
                <span className={`badge right ${status.rightOn ? "on" : ""}`}>
                  Dir
                </span>
                <span className={`badge gate ${status.gateOpen ? "on" : ""}`}>
                  GATE {status.gateOpen ? "ON" : "off"}
                </span>
                <span className={`badge vol ${status.volumeActive ? "on" : ""}`}>
                  VOL {status.volumeActive ? "ON" : "off"}
                </span>
                <span className="badge mode">{modeLabel}</span>
              </div>
              {useBrowser && camera.devices.length > 1 && (
                <select
                  className="camera-select"
                  value={camera.deviceId}
                  onChange={(e) => camera.setDeviceId(e.target.value)}
                  aria-label="Câmera"
                >
                  <option value="">Câmera padrão</option>
                  {camera.devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || d.deviceId}
                    </option>
                  ))}
                </select>
              )}
              <p className="hud-note" aria-live="polite" aria-atomic="true">
                <strong>{status.currentNote}</strong>
                <span className="dim">
                  {" "}
                  · {status.scaleName} · grau {status.scaleDegree + 1}/
                  {status.scaleSize} · {status.rightGesture}
                </span>
              </p>
              <p className="hud-line">
                {loop.loading ? (
                  <span>Carregando modelo…</span>
                ) : connected ? (
                  <span className="ok">
                    ● Ao vivo {useBrowser ? `(${loop.fps} fps)` : ""}
                  </span>
                ) : (
                  <span className="warn">○ Aguardando câmera ou WS</span>
                )}
              </p>
              {(camera.error || loop.error || live.error) && (
                <p className="hud-line warn">
                  {camera.error ?? loop.error ?? live.error}
                </p>
              )}
              <p className="hud-line dim">
                {lastNote} · Vol{" "}
                {(status.effectiveVolume * 100).toFixed(
                  status.volumeActive ? 1 : 0
                )}
                % · {status.playMode}
              </p>
              <div className="hud-actions">
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setShowHelp((v) => !v)}
                >
                  {showHelp ? "Ocultar ajuda" : "Como tocar"}
                </button>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setShowDebug((v) => !v)}
                >
                  {showDebug ? "Ocultar debug" : "Debug"}
                </button>
              </div>
              {showHelp && (
                <section className="help-card">
                  <table className="mapping-table">
                    <tbody>
                      <tr>
                        <td>Palma aberta (dir.)</td>
                        <td>Segura a nota</td>
                      </tr>
                      <tr>
                        <td>Punho (dir.)</td>
                        <td>Solta</td>
                      </tr>
                      <tr>
                        <td>Y (dir.)</td>
                        <td>Faixa da escala</td>
                      </tr>
                      <tr>
                        <td>Vitória V (dir.)</td>
                        <td>Segure: volume 0–100%</td>
                      </tr>
                      <tr>
                        <td>Polegar +/- (esq.)</td>
                        <td>Oitava</td>
                      </tr>
                    </tbody>
                  </table>
                </section>
              )}
              {showDebug && (
                <>
                  <button type="button" onClick={() => fileRef.current?.click()}>
                    Carregar NDJSON
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".ndjson,.jsonl,.json"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      void f.text().then(async (text) => {
                        for await (const ev of iterateNdjson(text)) handleEvent(ev);
                      });
                    }}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {!ready && (
        <div className="start-overlay">
          <button type="button" className="cta" onClick={() => void startExperience()}>
            Iniciar experiência
          </button>
          {showHelp && (
            <section className="help-card overlay-help">
              <h2>Instrumento gestual</h2>
              <p className="hint compact">
                Câmera e grade sonora lado a lado (ou empilhados no telemóvel).
                Modo dev: <code>?backend=ws</code> com Python local. Em mobile use
                HTTPS.
              </p>
              <table className="mapping-table">
                <tbody>
                  <tr>
                    <td>Palma aberta (dir.)</td>
                    <td>Segura a nota</td>
                  </tr>
                  <tr>
                    <td>Punho (dir.)</td>
                    <td>Solta</td>
                  </tr>
                  <tr>
                    <td>Y (dir.)</td>
                    <td>Faixa da escala</td>
                  </tr>
                  <tr>
                    <td>Vitória V (dir.)</td>
                    <td>Segure: volume 0–100%</td>
                  </tr>
                  <tr>
                    <td>Polegar +/- (esq.)</td>
                    <td>Oitava</td>
                  </tr>
                </tbody>
              </table>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
