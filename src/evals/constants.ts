const PROJECT_NAME = 'sage-prod';

/**
 * These are the users declared in the local Evergreen database.
 */
enum TestUser {
  Regular = 'regular',
  Privileged = 'privileged',
  Admin = 'admin',
}

enum ReporterName {
  Evergreen = 'Evergreen Eval Reporter',
  QuestionClassifier = 'Question Classifier Eval Reporter',
  SageThinking = 'Sage Thinking Eval Reporter',
  LogAnalyzerWorkflow = 'Log Analyzer Workflow Eval Reporter',
}

export { PROJECT_NAME, TestUser, ReporterName };
