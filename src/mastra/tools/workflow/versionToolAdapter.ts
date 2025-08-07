import getVersionTool from '../evergreen/getVersion';
import { createToolAdapter } from './createToolAdapter';

/**
 * This is an adapter tool that wraps around getVersionTool
 * to make it easier to use in workflows
 */
const versionToolAdapter = createToolAdapter(getVersionTool, {
  id: 'versionToolAdapter',
  description:
    'Adapter tool for getting Evergreen version information to use in workflows',
});

export default versionToolAdapter;
