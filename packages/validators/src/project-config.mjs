/** Cấu hình repo dự án của FE: `.frontend-delivery/standard.yaml`. */
import { loadProjectConfig as loadProjectConfigIn } from '@frontend-delivery-kit/engine';

export { PROJECT_CONFIG_DEFAULTS } from '@frontend-delivery-kit/engine';

export const PROJECT_CONFIG_FILE = '.frontend-delivery/standard.yaml';

/** @param {string} repoRoot */
export function loadProjectConfig(repoRoot) {
  return loadProjectConfigIn(repoRoot, { file: PROJECT_CONFIG_FILE });
}
