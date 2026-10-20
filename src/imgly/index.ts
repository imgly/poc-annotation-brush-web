/**
 * CE.SDK Annotation Brush Editor - Initialization Module
 *
 * This module provides the main entry point for initializing the annotation brush editor.
 * Import and call `initAnnotationBrushEditor()` to configure a CE.SDK instance with the
 * free-hand annotation brush, in the advanced design editor or the advanced video editor.
 */

import type CreativeEditorSDK from '@cesdk/cesdk-js';

import {
  ColorPaletteAssetSource,
  CropPresetsAssetSource,
  DemoAssetSources,
  EffectsAssetSource,
  FiltersAssetSource,
  ImageColorsAssetSource,
  StickerAssetSource,
  TextAssetSource,
  TextComponentAssetSource,
  TypefaceAssetSource,
  UploadAssetSources,
  VectorShapeAssetSource
} from '@cesdk/cesdk-js/plugins';

import { AdvancedEditorConfig } from './config/advanced-editor/plugin';
import { AdvancedVideoEditorConfig } from './config/advanced-video-editor/plugin';
import { setupAnnotationBrushPlugin } from './plugins/annotation-brush';

export { AdvancedEditorConfig } from './config/advanced-editor/plugin';
export { AdvancedVideoEditorConfig } from './config/advanced-video-editor/plugin';
export { setupAnnotationBrushPlugin } from './plugins/annotation-brush';

/** Which editor the kit runs. */
export type AnnotationBrushEditorMode = 'design' | 'video';

/**
 * Initialize the CE.SDK Annotation Brush Editor.
 *
 * This function configures a CE.SDK instance with:
 * - The advanced design editor or the advanced video editor. Both enable
 *   Edit Path, so strokes can be reshaped point by point.
 * - The annotation brush plugin, first in the dock
 * - Asset sources for images, shapes, stickers and text
 * - Export actions in the navigation bar
 *
 * @param cesdk - The CreativeEditorSDK instance to configure
 * @param mode - `'design'` for images and designs, `'video'` for video
 */
export async function initAnnotationBrushEditor(
  cesdk: CreativeEditorSDK,
  mode: AnnotationBrushEditorMode
) {
  await cesdk.addPlugin(
    mode === 'video'
      ? new AdvancedVideoEditorConfig()
      : new AdvancedEditorConfig()
  );

  await Promise.all([
    cesdk.addPlugin(new ImageColorsAssetSource()),
    cesdk.addPlugin(new ColorPaletteAssetSource()),
    cesdk.addPlugin(new CropPresetsAssetSource()),
    cesdk.addPlugin(new EffectsAssetSource()),
    cesdk.addPlugin(new FiltersAssetSource()),
    cesdk.addPlugin(new StickerAssetSource()),
    cesdk.addPlugin(new TextAssetSource()),
    cesdk.addPlugin(new TextComponentAssetSource()),
    cesdk.addPlugin(new TypefaceAssetSource()),
    cesdk.addPlugin(new VectorShapeAssetSource()),
    cesdk.addPlugin(
      new UploadAssetSources({
        include:
          mode === 'video'
            ? ['ly.img.image.upload', 'ly.img.video.upload']
            : ['ly.img.image.upload']
      })
    ),
    cesdk.addPlugin(
      new DemoAssetSources({
        include:
          mode === 'video'
            ? ['ly.img.image.*', 'ly.img.video.*']
            : ['ly.img.image.*']
      })
    )
  ]);

  cesdk.ui.insertOrderComponent(
    { in: 'ly.img.navigation.bar', position: 'end' },
    {
      id: 'ly.img.actions.navigationBar',
      children:
        mode === 'video'
          ? [
              'ly.img.saveScene.navigationBar',
              'ly.img.exportVideo.navigationBar',
              'ly.img.exportScene.navigationBar'
            ]
          : [
              'ly.img.saveScene.navigationBar',
              'ly.img.exportImage.navigationBar',
              'ly.img.exportPDF.navigationBar',
              'ly.img.exportScene.navigationBar'
            ]
    }
  );

  await setupAnnotationBrushPlugin(cesdk);
}
