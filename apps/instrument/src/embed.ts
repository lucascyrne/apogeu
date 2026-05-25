export function notifyInstrumentReady(): void {
  if (window.parent === window) return;
  let targetOrigin = "*";
  try {
    if (document.referrer) {
      targetOrigin = new URL(document.referrer).origin;
    }
  } catch {
    /* referrer inválido */
  }
  window.parent.postMessage(
    { type: "instrument.ready", source: "hand-gestures" },
    targetOrigin
  );
}
