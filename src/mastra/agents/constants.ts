/**
 * This is the user id that is used to identify the user in the request context.
 * It is used to identify the end user making the request to the downstream API.
 */
const USER_ID = 'userId';

const EVERGREEN_AGENT_NAME = 'evergreenAgent';
const QUESTION_CLASSIFIER_AGENT_NAME = 'questionClassifierAgent';
const RELEASE_NOTES_AGENT_NAME = 'releaseNotesAgent';
const SAGE_THINKING_AGENT_NAME = 'sageThinkingAgent';
const SLACK_THREAD_SUMMARIZER_AGENT_NAME = 'slackThreadSummarizerAgent';
const SLACK_QUESTION_OWNERSHIP_AGENT_NAME = 'questionOwnershipAgent';
const RUNTIME_ENVIRONMENTS_AGENT_NAME = 'runtimeEnvironmentsAgent';

const LOG_ANALYZER_WORKFLOW_NAME = 'logCoreAnalyzerWorkflow';
const RELEASE_NOTES_WORKFLOW_NAME = 'releaseNotesWorkflow';

export {
  USER_ID,
  EVERGREEN_AGENT_NAME,
  QUESTION_CLASSIFIER_AGENT_NAME,
  RELEASE_NOTES_AGENT_NAME,
  RUNTIME_ENVIRONMENTS_AGENT_NAME,
  SAGE_THINKING_AGENT_NAME,
  SLACK_THREAD_SUMMARIZER_AGENT_NAME,
  SLACK_QUESTION_OWNERSHIP_AGENT_NAME,
  LOG_ANALYZER_WORKFLOW_NAME,
  RELEASE_NOTES_WORKFLOW_NAME,
};
