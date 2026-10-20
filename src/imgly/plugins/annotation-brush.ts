/**
 * Annotation Brush Plugin
 *
 * Adds the free-hand annotation brush from `src/annotation-brush`. Each stroke
 * becomes an editable vector path with a dashed, dotted or solid stroke.
 *
 * ## Usage
 *
 * ```typescript
 * import { setupAnnotationBrushPlugin } from './plugins/annotation-brush';
 *
 * // After cesdk initialization
 * await setupAnnotationBrushPlugin(cesdk);
 * ```
 */

import type CreativeEditorSDK from '@cesdk/cesdk-js';
import AnnotationBrushPlugin, {
  ANNOTATION_BRUSH_DOCK_COMPONENT_ID
} from '../../annotation-brush';

/**
 * Adds the annotation brush plugin and puts its button first in the dock.
 *
 * @param cesdk - The CreativeEditorSDK instance
 */
export async function setupAnnotationBrushPlugin(
  cesdk: CreativeEditorSDK
): Promise<void> {
  await cesdk.addPlugin(
    AnnotationBrushPlugin({
      defaults: {
        // Yellow reads on both water and vegetation in the demo imagery.
        color: { r: 1, g: 0.83, b: 0, a: 1 },
        style: 'Dashed',
        width: 6
      },
      onStrokeCreated: (block) => {
        // The SVG path data of the new stroke, e.g. to store it in your backend.
        const shape = cesdk.engine.block.getShape(block);
        // eslint-disable-next-line no-console
        console.log(
          'Annotation stroke created:',
          cesdk.engine.block.getString(shape, 'shape/vector_path/path')
        );
      }
    })
  );

  // The plugin registers the button but leaves its placement to the app.
  cesdk.ui.setComponentOrder({ in: 'ly.img.dock' }, [
    ANNOTATION_BRUSH_DOCK_COMPONENT_ID,
    ...cesdk.ui.getComponentOrder({ in: 'ly.img.dock' })
  ]);
}
