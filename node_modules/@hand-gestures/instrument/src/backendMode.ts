export type BackendMode = "browser" | "ws" | "demo";

export function getBackendMode(): BackendMode {
  const params = new URLSearchParams(window.location.search);
  if (params.get("backend") === "ws") return "ws";
  if (params.get("demo") === "1") return "demo";
  return "browser";
}
