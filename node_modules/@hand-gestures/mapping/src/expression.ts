import { extractRawFeatures, type RawFeatures } from "./features";
import { SmoothedFeatures } from "./smooth";
import type { HandsSnapshot } from "./types";

export type SmoothedHandFeatures = {
  presence: boolean;
  x_norm: number;
  y_norm: number;
  z_norm: number;
  spatial_x: number;
  spatial_y: number;
  pan: number;
};

export type SmoothedFrame = {
  left: SmoothedHandFeatures;
  right: SmoothedHandFeatures;
  hands_distance: number;
  spread: number;
};

export type ExpressionOptions = {
  alpha?: number;
  pitchAlpha?: number;
  spatialAlpha?: number;
  distanceAlpha?: number;
};

export class ExpressionEngine {
  private smooth: SmoothedFeatures;

  constructor(opts: ExpressionOptions = {}) {
    this.smooth = new SmoothedFeatures(
      opts.alpha ?? 0.2,
      opts.pitchAlpha ?? 0.15,
      opts.spatialAlpha ?? 0.25,
      opts.distanceAlpha ?? 0.22
    );
  }

  process(snapshot: HandsSnapshot | null): SmoothedFrame {
    return this.smoothRaw(extractRawFeatures(snapshot));
  }

  private smoothRaw(raw: RawFeatures): SmoothedFrame {
    const s = this.smooth;
    return {
      left: {
        presence: raw.left.presence,
        x_norm: s.filter("lx", raw.left.x_norm, "spatial"),
        y_norm: s.filter("ly", raw.left.y_norm, "pitch"),
        z_norm: s.filter("lz", raw.left.z_norm, "spatial"),
        spatial_x: s.filter("lsx", raw.left.spatial_x, "spatial"),
        spatial_y: s.filter("lsy", raw.left.spatial_y, "spatial"),
        pan: 0,
      },
      right: {
        presence: raw.right.presence,
        x_norm: s.filter("rx", raw.right.x_norm, "spatial"),
        y_norm: s.filter("ry", raw.right.y_norm, "pitch"),
        z_norm: s.filter("rz", raw.right.z_norm, "spatial"),
        spatial_x: s.filter("rsx", raw.right.spatial_x, "spatial"),
        spatial_y: s.filter("rsy", raw.right.spatial_y, "spatial"),
        pan: 0,
      },
      hands_distance: s.filter("dist", raw.hands_distance, "distance"),
      spread: s.filter("spread", raw.spread, "distance"),
    };
  }
}
