/** Área central de captura (75% do quadro da câmera). */

import { clamp01 } from "./smooth";

export const CAPTURE_SIZE = 0.75;
export const ROI_MARGIN = (1 - CAPTURE_SIZE) / 2;

export function inCaptureRoi(x: number, y: number): boolean {
  const hi = 1 - ROI_MARGIN;
  return x >= ROI_MARGIN && x <= hi && y >= ROI_MARGIN && y <= hi;
}

export function mapPointToRoi(
  x: number,
  y: number
): { x: number; y: number } | null {
  if (!inCaptureRoi(x, y)) return null;
  return {
    x: (x - ROI_MARGIN) / CAPTURE_SIZE,
    y: (y - ROI_MARGIN) / CAPTURE_SIZE,
  };
}

export function clampToCaptureRoi(x: number, y: number): { x: number; y: number } {
  const hi = 1 - ROI_MARGIN;
  return {
    x: Math.max(ROI_MARGIN, Math.min(hi, x)),
    y: Math.max(ROI_MARGIN, Math.min(hi, y)),
  };
}

/** ROI normalizada; fora da área → projeta na borda (evita EMPTY). */
export function mapPointToRoiClamped(
  x: number,
  y: number
): { x: number; y: number; in_roi: boolean } {
  const inRoi = inCaptureRoi(x, y);
  const c = inRoi ? { x, y } : clampToCaptureRoi(x, y);
  return {
    x: (c.x - ROI_MARGIN) / CAPTURE_SIZE,
    y: (c.y - ROI_MARGIN) / CAPTURE_SIZE,
    in_roi: inRoi,
  };
}

/** Mão para cima → valor alto (pitch / eixo Y lógico). */
export function roiYToPitchNorm(roiY: number): number {
  return clamp01(1 - roiY);
}

/** Pitch 0–1 com platô fora da ROI (evita saltos ao sair do ecrã). */
export function pitchNormFromCameraPoint(
  x: number,
  y: number,
  pitchAxis: "x" | "y" | "z" = "y"
): number {
  const hi = 1 - ROI_MARGIN;
  if (pitchAxis === "y") {
    if (y < ROI_MARGIN) return 1;
    if (y > hi) return 0;
    const roi = mapPointToRoi(x, y);
    if (!roi) return clamp01(1 - y);
    return roiYToPitchNorm(roi.y);
  }
  if (pitchAxis === "x") {
    if (x < ROI_MARGIN) return 0;
    if (x > hi) return 1;
    const roi = mapPointToRoi(x, y);
    if (!roi) return clamp01(x);
    return clamp01(roi.x);
  }
  return clamp01(-y * 0.5 + 0.5);
}

export type RoiScreenRect = { x0: number; y0: number; w: number; h: number };

export function roiScreenRect(canvasW: number, canvasH: number): RoiScreenRect {
  return {
    x0: canvasW * ROI_MARGIN,
    y0: canvasH * ROI_MARGIN,
    w: canvasW * CAPTURE_SIZE,
    h: canvasH * CAPTURE_SIZE,
  };
}

/** Coordenadas de controle (0–1 na ROI) → pixels; X espelhado como na câmera. */
export function controlToScreen(
  x: number,
  y: number,
  rect: RoiScreenRect
): { sx: number; sy: number } {
  return {
    sx: rect.x0 + (1 - x) * rect.w,
    sy: rect.y0 + (1 - y) * rect.h,
  };
}

/** Posição espacial na ROI → pixel (Y da câmera, não pitch). */
export function spatialToScreen(
  spatialX: number,
  spatialY: number,
  rect: RoiScreenRect
): { sx: number; sy: number } {
  return {
    sx: rect.x0 + (1 - spatialX) * rect.w,
    sy: rect.y0 + spatialY * rect.h,
  };
}
