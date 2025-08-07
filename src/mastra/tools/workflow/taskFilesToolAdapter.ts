import getTaskTool from '../evergreen/getTask';
import getTaskFilesTool from '../evergreen/getTaskFiles';
import getTaskTestsTool from '../evergreen/getTaskTests';
import { createToolAdapter } from './createToolAdapter';

/**
 * This is an adapter tool that wraps around getTaskFilesTool
 * to make it easier to use in workflows
 */
const taskFilesToolAdapter = createToolAdapter(getTaskFilesTool, {
  id: 'taskFilesToolAdapter',
  description:
    'Adapter tool for getting Evergreen task files information to use in workflows',
});

export default taskFilesToolAdapter;
