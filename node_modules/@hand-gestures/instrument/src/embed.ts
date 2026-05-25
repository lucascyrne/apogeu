export function notifyInstrumentReady(): void {
  if (window.parent === window) return;
  window.parent.postMessage(
    { type: "instrument.ready", source: "hand-gestures" },
    "*"
  );
}
