import type CreativeEditorSDK from '@cesdk/cesdk-js';
import type { EditorPlugin } from '@cesdk/cesdk-js';
import type { Color, DesignBlockId, StrokeStyle } from '@cesdk/engine';

import { buildStrokePath, type Point } from './geometry';
import { attachBrushInput } from './input';
import { createStrokeBlock, pixelsToDesignUnits } from './stroke';
import {
  ANNOTATION_BRUSH_DOCK_COMPONENT_ID,
  ANNOTATION_BRUSH_PANEL_ID,
  STROKE_STYLES,
  translationKeys,
  translations
} from './constants';

export const PLUGIN_ID = 'annotation-brush';

// Seconds before a clip's end that still show the clip.
const CLIP_END_MARGIN = 0.05;

/** Where the plugin inserts its button. */
export type Location = 'dock';

/** Starting values of the controls in the annotation brush panel. */
export interface AnnotationBrushDefaults {
  color: Color;
  /** Any CE.SDK stroke style. */
  style: StrokeStyle;
  /**
   * Stroke width in pixels. The plugin converts it to the scene's design unit
   * at the scene's DPI, so a millimeter page gets about 0.5 mm for 6 px at 300 DPI.
   */
  width: number;
  /** Joins the end point back to the start point. */
  closePath: boolean;
  /** Fits a smooth curve through the stroke instead of keeping the raw line. */
  smooth: boolean;
  /** Smoothing strength, 1 to 10. */
  smoothing: number;
  /** Seconds a stroke stays visible from the playhead. Video timelines only. */
  clipDuration: number;
}

export interface PluginConfiguration {
  ui?: {
    /** Where to insert the annotation brush button. Default: nowhere. */
    locations?: Location | Location[];
  };
  /** Starting values of the panel controls. */
  defaults?: Partial<AnnotationBrushDefaults>;
  /** Called after each stroke became a block. */
  onStrokeCreated?: (block: DesignBlockId) => void;
}

export const DEFAULTS: AnnotationBrushDefaults = {
  color: { r: 1, g: 0.83, b: 0, a: 1 },
  style: 'Dashed',
  width: 6,
  closePath: false,
  smooth: true,
  smoothing: 3,
  clipDuration: 5
};

export default (
  configuration: PluginConfiguration = {}
): Omit<EditorPlugin, 'name' | 'version'> => ({
  initialize({ cesdk }) {
    if (cesdk == null) return;
    const options: AnnotationBrushDefaults = {
      ...DEFAULTS,
      ...configuration.defaults
    };

    setDefaultTranslations(cesdk);
    addIconSet(cesdk);

    let detach: (() => void) | null = null;
    const deactivate = () => {
      detach?.();
      detach = null;
    };
    const activate = () => {
      if (detach != null) return;
      cesdk.engine.block
        .findAllSelected()
        .forEach((block) => cesdk.engine.block.setSelected(block, false));
      const stop = attachBrushInput(cesdk.engine, {
        previewStyle: () => ({
          color: toCssColor(options.color, 0.7),
          width: pixelsToDesignUnits(cesdk.engine, options.width)
        }),
        onStrokeStart: () => pausePlayback(cesdk),
        onStrokeEnd: (page, points) => {
          const block = commitStroke(cesdk, page, points, options);
          configuration.onStrokeCreated?.(block);
        }
      });
      // The UI has no event for a closed panel, so check once per frame while
      // the annotation brush is on. `dispose()` leaves the panel marked open, so a removed
      // canvas also stops the annotation brush.
      let frame = 0;
      const watch = () => {
        if (!isBrushPanelShown(cesdk)) {
          deactivate();
          return;
        }
        frame = requestAnimationFrame(watch);
      };
      frame = requestAnimationFrame(watch);
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        // Escape in a text field or a picker belongs to that control.
        if (isEditableTarget(event.composedPath()[0])) return;
        cesdk.ui.closePanel(ANNOTATION_BRUSH_PANEL_ID);
      };
      window.addEventListener('keydown', onKeyDown);
      detach = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('keydown', onKeyDown);
        stop();
      };
    };

    cesdk.ui.registerComponent(
      ANNOTATION_BRUSH_DOCK_COMPONENT_ID,
      ({ builder }) => {
        const isOpen = cesdk.ui.isPanelOpen(ANNOTATION_BRUSH_PANEL_ID);
        builder.Button(`${ANNOTATION_BRUSH_DOCK_COMPONENT_ID}.button`, {
          label: translationKeys.dockLabel,
          icon: '@imgly/plugin/annotationBrush',
          isSelected: isOpen,
          onClick: () =>
            isOpen
              ? cesdk.ui.closePanel(ANNOTATION_BRUSH_PANEL_ID)
              : cesdk.ui.openPanel(ANNOTATION_BRUSH_PANEL_ID)
        });
      }
    );

    cesdk.ui.registerPanel(ANNOTATION_BRUSH_PANEL_ID, ({ builder, state }) => {
      // The panel renders only while it is open.
      activate();

      const bind = <K extends keyof AnnotationBrushDefaults>(key: K) => {
        const value = state(`${PLUGIN_ID}.${key}`, options[key]);
        return {
          value: value.value,
          setValue: (next: AnnotationBrushDefaults[K]) => {
            options[key] = next;
            value.setValue(next);
          }
        };
      };
      const style = bind('style');
      const smooth = bind('smooth');

      builder.Section(`${ANNOTATION_BRUSH_PANEL_ID}.hint`, {
        children: () => {
          builder.Text(`${ANNOTATION_BRUSH_PANEL_ID}.hint.text`, {
            content: translationKeys.hint
          });
        }
      });
      builder.Section(`${ANNOTATION_BRUSH_PANEL_ID}.line`, {
        title: translationKeys.line,
        children: () => {
          builder.ColorInput(`${ANNOTATION_BRUSH_PANEL_ID}.color`, {
            inputLabel: translationKeys.color,
            ...bind('color')
          });
          const values = STROKE_STYLES.map((id) => ({
            id,
            label: translationKeys.style(id)
          }));
          builder.Select(`${ANNOTATION_BRUSH_PANEL_ID}.style`, {
            inputLabel: translationKeys.styleLabel,
            values,
            value: values.find((v) => v.id === style.value) ?? values[0],
            setValue: (next) => style.setValue(next.id as StrokeStyle)
          });
          builder.Slider(`${ANNOTATION_BRUSH_PANEL_ID}.width`, {
            inputLabel: translationKeys.width,
            min: 1,
            max: 40,
            step: 1,
            ...bind('width')
          });
          builder.Checkbox(`${ANNOTATION_BRUSH_PANEL_ID}.closePath`, {
            inputLabel: translationKeys.closePath,
            ...bind('closePath')
          });
          builder.Checkbox(`${ANNOTATION_BRUSH_PANEL_ID}.smooth`, {
            inputLabel: translationKeys.smooth,
            ...smooth
          });
          builder.Slider(`${ANNOTATION_BRUSH_PANEL_ID}.smoothing`, {
            inputLabel: translationKeys.smoothing,
            min: 1,
            max: 10,
            step: 1,
            isDisabled: !smooth.value,
            ...bind('smoothing')
          });
        }
      });

      if (!hasTimeline(cesdk)) return;
      builder.Section(`${ANNOTATION_BRUSH_PANEL_ID}.timing`, {
        title: translationKeys.timing,
        children: () => {
          builder.Slider(`${ANNOTATION_BRUSH_PANEL_ID}.clipDuration`, {
            inputLabel: translationKeys.clipDuration,
            min: 1,
            max: 30,
            step: 0.5,
            ...bind('clipDuration')
          });
        }
      });
    });

    const locations = [configuration.ui?.locations ?? []].flat();
    if (locations.includes('dock')) {
      cesdk.ui.insertOrderComponent(
        { in: 'ly.img.dock', position: 'end' },
        ANNOTATION_BRUSH_DOCK_COMPONENT_ID
      );
    }
  }
});

function isBrushPanelShown(cesdk: CreativeEditorSDK): boolean {
  try {
    return (
      cesdk.ui.isPanelOpen(ANNOTATION_BRUSH_PANEL_ID) &&
      cesdk.engine.element?.isConnected === true
    );
  } catch {
    // A disposed editor throws on access.
    return false;
  }
}

function isEditableTarget(target: EventTarget | undefined): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
}

/** Video editors show a timeline; there a stroke becomes a clip. */
function hasTimeline(cesdk: CreativeEditorSDK): boolean {
  return cesdk.feature.isEnabled('ly.img.video.timeline');
}

/** A stroke starts at the frame the user draws on, so stop the playhead. */
function pausePlayback(cesdk: CreativeEditorSDK) {
  const page = cesdk.engine.scene.getCurrentPage();
  if (page == null || !cesdk.engine.block.supportsPlaybackControl(page)) return;
  cesdk.engine.block.setPlaying(page, false);
}

function commitStroke(
  cesdk: CreativeEditorSDK,
  page: DesignBlockId,
  screenPoints: Point[],
  options: AnnotationBrushDefaults
): DesignBlockId {
  const engine = cesdk.engine;
  // Screen space is CSS pixels relative to the engine canvas.
  const [pageX, pageY, pageScreenWidth] =
    engine.block.getScreenSpaceBoundingBoxXYWH([page]);
  const scale = engine.block.getWidth(page) / pageScreenWidth;
  const geometry = buildStrokePath(
    screenPoints,
    (p) => ({ x: (p.x - pageX) * scale, y: (p.y - pageY) * scale }),
    options
  );
  const block = createStrokeBlock(engine, page, geometry, {
    ...options,
    width: pixelsToDesignUnits(engine, options.width)
  });

  if (hasTimeline(cesdk)) {
    const playhead = engine.block.getPlaybackTime(page);
    const videoDuration = engine.block.getDuration(page);
    const duration = Math.min(options.clipDuration, videoDuration);
    // Near the end of the video the clip moves back so it still fits. After
    // playback ends the playhead sits past the clip, so it moves onto the
    // clip's last moment, where the new stroke is visible.
    const start = Math.min(playhead, videoDuration - duration);
    engine.block.setTimeOffset(block, start);
    engine.block.setDuration(block, duration);
    if (playhead >= start + duration) {
      engine.block.setPlaybackTime(page, start + duration - CLIP_END_MARGIN);
    }
    // A timeline that shows only the selected row would otherwise hide the
    // new clip, the same as for assets from the library.
    engine.block.select(block);
  }
  engine.editor.addUndoStep();
  return block;
}

/** The preview approximates CMYK and spot colors with a neutral gray. */
function toCssColor(color: Color, alpha: number): string {
  if ('r' in color) {
    const c = (v: number) => Math.round(v * 255);
    return `rgba(${c(color.r)}, ${c(color.g)}, ${c(color.b)}, ${
      alpha * color.a
    })`;
  }
  return `rgba(128, 128, 128, ${alpha})`;
}

/** Sets English and German labels for keys the integrator has not set already. */
function setDefaultTranslations(cesdk: CreativeEditorSDK) {
  const locales = ['en', 'de'] as const;
  const existing = cesdk.i18n.getTranslations([...locales]);
  cesdk.i18n.setTranslations(
    Object.fromEntries(
      locales.map((locale) => {
        const set = (existing[locale] ?? {}) as Record<string, string>;
        return [
          locale,
          Object.fromEntries(
            Object.entries(translations[locale]).filter(
              ([key]) => !(key in set)
            )
          )
        ];
      })
    )
  );
}

function addIconSet(cesdk: CreativeEditorSDK) {
  cesdk.ui.addIconSet(
    '@imgly/plugin/annotationBrush',
    `<svg>
      <symbol fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" id="@imgly/plugin/annotationBrush">
        <path d="M14.5 4.5L19.5 9.5L10 19H5V14L14.5 4.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M12.5 6.5L17.5 11.5" stroke="currentColor" stroke-width="1.5"/>
        <path d="M3 21.5C6 21.5 7 20.5 9.5 20.5S13 21.5 15 21.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2 2"/>
      </symbol>
    </svg>`
  );
}
