import getTaskTool from '../evergreen/getTask';
import getTaskTestsTool from '../evergreen/getTaskTests';
import { createToolAdapter } from './createToolAdapter';

/**
 * This is an adapter tool that wraps around getTaskTestsTool
 * to make it easier to use in workflows
 */
const taskTestsToolAdapter = createToolAdapter(getTaskTestsTool, {
  id: 'taskTestsToolAdapter',
  description:
    'Adapter tool for getting Evergreen task tests information to use in workflows',
});

export default taskTestsToolAdapter;
