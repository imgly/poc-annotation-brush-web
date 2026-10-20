import type { StrokeStyle } from '@cesdk/engine';

/** Component ID of the button that opens and closes the annotation brush panel. */
export const ANNOTATION_BRUSH_DOCK_COMPONENT_ID = 'ly.img.annotationBrush.dock';

/** Panel ID. Open it with `cesdk.ui.openPanel(ANNOTATION_BRUSH_PANEL_ID)` to start drawing. */
export const ANNOTATION_BRUSH_PANEL_ID = '//ly.img.panel/annotationBrush';

/** Stroke styles offered in the panel, in display order. */
export const STROKE_STYLES: StrokeStyle[] = [
  'Dashed',
  'DashedRound',
  'LongDashed',
  'LongDashedRound',
  'Dotted',
  'Solid'
];

const panel = `panel.${ANNOTATION_BRUSH_PANEL_ID}`;

/** Translation keys the plugin uses. */
export const translationKeys = {
  dockLabel: 'ly.img.annotationBrush.dock.label',
  panel,
  hint: `${panel}.hint`,
  line: `${panel}.line`,
  color: `${panel}.color`,
  styleLabel: `${panel}.style`,
  style: (style: StrokeStyle) => `ly.img.annotationBrush.style.${style}`,
  width: `${panel}.width`,
  closePath: `${panel}.closePath`,
  smooth: `${panel}.smooth`,
  smoothing: `${panel}.smoothing`,
  timing: `${panel}.timing`,
  clipDuration: `${panel}.clipDuration`
} as const;

const styleLabels: Record<'en' | 'de', Record<StrokeStyle, string>> = {
  en: {
    Dashed: 'Dashed',
    DashedRound: 'Dashed, round',
    LongDashed: 'Long dashed',
    LongDashedRound: 'Long dashed, round',
    Dotted: 'Dotted',
    Solid: 'Solid'
  },
  de: {
    Dashed: 'Gestrichelt',
    DashedRound: 'Gestrichelt, rund',
    LongDashed: 'Lang gestrichelt',
    LongDashedRound: 'Lang gestrichelt, rund',
    Dotted: 'Gepunktet',
    Solid: 'Durchgezogen'
  }
};

const styleTranslations = (locale: 'en' | 'de') =>
  Object.fromEntries(
    STROKE_STYLES.map((style) => [
      translationKeys.style(style),
      styleLabels[locale][style]
    ])
  );

/** English and German defaults. The plugin sets only keys the integrator has not set. */
export const translations: Record<'en' | 'de', Record<string, string>> = {
  en: {
    [translationKeys.dockLabel]: 'Annotation Brush',
    [translationKeys.panel]: 'Annotation Brush',
    [translationKeys.hint]:
      'Draw on the page. Each stroke becomes a vector path. Close this panel or press Escape to stop drawing.',
    [translationKeys.line]: 'Line',
    [translationKeys.color]: 'Color',
    [translationKeys.styleLabel]: 'Style',
    [translationKeys.width]: 'Width (px)',
    [translationKeys.closePath]: 'Connect start and end point',
    [translationKeys.smooth]: 'Smooth line after drawing',
    [translationKeys.smoothing]: 'Smoothing',
    [translationKeys.timing]: 'Timing',
    [translationKeys.clipDuration]: 'Show for (s)',
    ...styleTranslations('en')
  },
  de: {
    [translationKeys.dockLabel]: 'Annotationspinsel',
    [translationKeys.panel]: 'Annotationspinsel',
    [translationKeys.hint]:
      'Zeichne auf der Seite. Jeder Strich wird zu einem Vektorpfad. Schließe dieses Panel oder drücke Escape, um das Zeichnen zu beenden.',
    [translationKeys.line]: 'Linie',
    [translationKeys.color]: 'Farbe',
    [translationKeys.styleLabel]: 'Stil',
    [translationKeys.width]: 'Breite (px)',
    [translationKeys.closePath]: 'Start- und Endpunkt verbinden',
    [translationKeys.smooth]: 'Linie nach dem Zeichnen glätten',
    [translationKeys.smoothing]: 'Glättung',
    [translationKeys.timing]: 'Timing',
    [translationKeys.clipDuration]: 'Anzeigen für (s)',
    ...styleTranslations('de')
  }
};
