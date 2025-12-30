/**
 * Shared types for question ownership routes
 */

/** Standard error response for question ownership routes */
export type ErrorResponse = {
  message: string;
};

/** Question ownership response with team information and reasoning */
export type QuestionOwnershipResponse = {
  teamName: string;
  teamId: string;
  reasoning: string;
};

/** Response for upsert operations */
export type UpsertQuestionOwnershipResponse = {
  message: string;
  count: number;
};

/** Question-team mapping for upsert operations */
export type QuestionTeamMapping = {
  question: string;
  teamName: string;
  teamId: string;
};
