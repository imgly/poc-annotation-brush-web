import plugin, { PLUGIN_ID, type PluginConfiguration } from './plugin';

const Plugin = (pluginConfiguration?: PluginConfiguration) => ({
  name: PLUGIN_ID,
  version: '1.0.0',
  ...plugin(pluginConfiguration)
});

export default Plugin;
export {
  PLUGIN_ID,
  DEFAULTS,
  type AnnotationBrushDefaults,
  type Location,
  type PluginConfiguration
} from './plugin';
export {
  ANNOTATION_BRUSH_DOCK_COMPONENT_ID,
  ANNOTATION_BRUSH_PANEL_ID,
  translationKeys
} from './constants';
export { STROKE_METADATA_KEY, type StrokeMetadata } from './stroke';
