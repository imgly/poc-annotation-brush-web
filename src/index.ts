/**
 * CE.SDK Annotation Brush - Example Application
 *
 * An editor with a free-hand annotation brush. Open the Annotation Brush panel from the dock and draw
 * on the page; each stroke becomes an editable dashed vector path. Add
 * `?mode=video` to the URL, or use "Switch to video", for the video editor.
 */

import CreativeEditorSDK from '@cesdk/cesdk-js';

import {
  initAnnotationBrushEditor,
  type AnnotationBrushEditorMode
} from './imgly';
import { DEMO_ASSETS_BASE_URL } from './imgly/demo-assets';

// ============================================================================
// Configuration
// ============================================================================

const config = {
  userId: 'annotation-brush-example-user',
  // Without a license the editor runs in evaluation mode with a watermark.
  license: import.meta.env.VITE_CESDK_LICENSE
};

const mode: AnnotationBrushEditorMode =
  new URLSearchParams(window.location.search).get('mode') === 'video'
    ? 'video'
    : 'design';

// ============================================================================
// Initialize Annotation Brush Editor
// ============================================================================

CreativeEditorSDK.create('#cesdk_container', config)
  .then(async (cesdk) => {
    await initAnnotationBrushEditor(cesdk, mode);

    // ============================================================================
    // Scene
    // ============================================================================

    if (mode === 'video') {
      // A 12 s pan over the aerial photo, 1920 × 1080.
      await cesdk.engine.scene.createFromVideo(
        `${DEMO_ASSETS_BASE_URL}/assets/aerial-flyover.mp4`
      );
    } else {
      // A top-down photo of a coastline, 2500 × 1667, as the page background.
      await cesdk.engine.scene.createFromImage(
        `${DEMO_ASSETS_BASE_URL}/assets/aerial-coast.jpg`
      );
    }
    // Fits the page between the editor panels and keeps it fitted while the
    // layout settles and the window resizes, until the user zooms.
    await cesdk.actions.run('zoom.toPage', { autoFit: true });

    // Switches between the design and the video editor by reloading the page.
    cesdk.i18n.setTranslations({
      en: {
        'example.annotationBrush.modeSwitch.toDesign': 'Switch to design',
        'example.annotationBrush.modeSwitch.toVideo': 'Switch to video'
      },
      de: {
        'example.annotationBrush.modeSwitch.toDesign': 'Zum Design wechseln',
        'example.annotationBrush.modeSwitch.toVideo': 'Zum Video wechseln'
      }
    });
    cesdk.ui.registerComponent(
      'example.annotationBrush.modeSwitch',
      ({ builder }) => {
        builder.Button('example.annotationBrush.modeSwitch.button', {
          label:
            mode === 'video'
              ? 'example.annotationBrush.modeSwitch.toDesign'
              : 'example.annotationBrush.modeSwitch.toVideo',
          icon: mode === 'video' ? '@imgly/Image' : '@imgly/Video',
          variant: 'regular',
          onClick: () => {
            const url = new URL(window.location.href);
            url.searchParams.set('mode', mode === 'video' ? 'design' : 'video');
            window.location.assign(url);
          }
        });
      }
    );
    cesdk.ui.insertOrderComponent(
      { in: 'ly.img.navigation.bar', position: 'end' },
      'example.annotationBrush.modeSwitch'
    );
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize CE.SDK:', error);
  });
