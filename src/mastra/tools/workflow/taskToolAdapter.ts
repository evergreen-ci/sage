import getTaskTool from '../evergreen/getTask';
import { createToolAdapter } from './createToolAdapter';

/**
 * This is an adapter tool that wraps around getTaskTool
 * to make it easier to use in workflows
 */
const taskToolAdapter = createToolAdapter(getTaskTool, {
  id: 'taskToolAdapter',
  description:
    'Adapter tool for getting Evergreen task information to use in workflows',
});

export default taskToolAdapter;
