import type CreativeEngine from '@cesdk/engine';
import type { Color, DesignBlockId, StrokeStyle } from '@cesdk/engine';

import type { PathGeometry } from './geometry';

/** The look of a annotation brush stroke. */
export interface StrokeAppearance {
  color: Color;
  style: StrokeStyle;
  /** Stroke width in design units. */
  width: number;
}

/** Metadata key on every block the plugin creates. Equal to the plugin ID. */
export const STROKE_METADATA_KEY = 'annotation-brush';

/** Value stored under {@link STROKE_METADATA_KEY}. */
export interface StrokeMetadata {
  version: 1;
}

/**
 * Converts a length in pixels to the scene's design unit, at the scene's DPI.
 * The engine converts font sizes the same way.
 */
export function pixelsToDesignUnits(
  engine: CreativeEngine,
  pixels: number
): number {
  const scene = engine.scene.get();
  if (scene == null) return pixels;
  const dpi = engine.block.getFloat(scene, 'scene/dpi');
  switch (engine.scene.getDesignUnit()) {
    case 'Millimeter':
      return (pixels / dpi) * 25.4;
    case 'Inch':
      return pixels / dpi;
    default:
      return pixels;
  }
}

/**
 * Creates a `graphic` block with a `vector_path` shape and appends it to `page`.
 *
 * @param engine - The engine to create the block in.
 * @param page - The page that receives the block.
 * @param geometry - Path data and frame, in the page's design units.
 * @param appearance - Stroke color, style and width.
 * @returns The new block.
 */
export function createStrokeBlock(
  engine: CreativeEngine,
  page: DesignBlockId,
  geometry: PathGeometry,
  appearance: StrokeAppearance
): DesignBlockId {
  const block = engine.block.create('graphic');
  const shape = engine.block.createShape('vector_path');
  engine.block.setString(shape, 'shape/vector_path/path', geometry.path);
  // The engine scales the path from this frame into the block frame. Both have
  // the same size, so the path keeps the size it was drawn at.
  engine.block.setFloat(shape, 'shape/vector_path/width', geometry.width);
  engine.block.setFloat(shape, 'shape/vector_path/height', geometry.height);
  engine.block.setShape(block, shape);

  // A new graphic has no fill, and the video timeline reads the fill of every
  // clip to trim it. It fails on a missing fill, so the stroke gets a
  // transparent one that is switched off.
  const fill = engine.block.createFill('color');
  engine.block.setColor(fill, 'fill/color/value', { r: 0, g: 0, b: 0, a: 0 });
  engine.block.setFill(block, fill);
  engine.block.setFillEnabled(block, false);

  engine.block.setStrokeEnabled(block, true);
  engine.block.setStrokeColor(block, appearance.color);
  engine.block.setStrokeWidth(block, appearance.width);
  engine.block.setStrokeStyle(block, appearance.style);
  engine.block.setStrokePosition(block, 'Center');
  // Miter joins draw long spikes at the sharp turns of an unsmoothed stroke.
  engine.block.setStrokeCornerGeometry(block, 'Round');

  engine.block.setWidth(block, geometry.width);
  engine.block.setHeight(block, geometry.height);
  engine.block.setPositionX(block, geometry.x);
  engine.block.setPositionY(block, geometry.y);
  engine.block.appendChild(page, block);

  const metadata: StrokeMetadata = { version: 1 };
  engine.block.setMetadata(
    block,
    STROKE_METADATA_KEY,
    JSON.stringify(metadata)
  );
  return block;
}
