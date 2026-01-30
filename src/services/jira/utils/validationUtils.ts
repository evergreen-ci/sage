import { credentialsExist } from '@/db/repositories/userCredentialsRepository';
import { SAGE_BOT_DOCS_LINKS } from '../constants';
import { ParsedTicketData, ValidationResult } from '../types';

/**
 * Validate that a ticket has a repository label
 * Checks that a repo:<org>/<repo> label exists (with optional `@ref`)
 * @param ticketData - The parsed ticket data to validate
 * @returns Error message if invalid, null if valid
 */
export const validateRepositoryLabel = (
  ticketData: ParsedTicketData
): string | null => {
  if (!ticketData.targetRepository) {
    return (
      'Missing repository label. Please add a label in the format: repo:<org>/<repo_name> or repo:<org>/<repo_name>@<branch>. ' +
      `See the [repository label documentation|${SAGE_BOT_DOCS_LINKS.REPOSITORY_LABEL_FORMAT}] for details.`
    );
  }

  return null;
};

/**
 * Validate that a ticket has an assignee
 * @param ticketData - The parsed ticket data to validate
 * @returns Error message if invalid, null if valid
 */
export const validateAssignee = (
  ticketData: ParsedTicketData
): string | null => {
  if (!ticketData.assigneeEmail) {
    return (
      'No assignee set. Please assign this ticket to a user. ' +
      `See the [usage guide|${SAGE_BOT_DOCS_LINKS.USAGE_GUIDE}] for ticket requirements.`
    );
  }
  return null;
};

/**
 * Validate that the assignee has credentials configured
 * @param assigneeEmail - The assignee's email address
 * @returns Error message if invalid, null if valid
 */
export const validateCredentials = async (
  assigneeEmail: string
): Promise<string | null> => {
  const hasCredentials = await credentialsExist(assigneeEmail);
  if (!hasCredentials) {
    return (
      `Assignee (${assigneeEmail}) does not have credentials configured. ` +
      `Please register your API key before using sage-bot. ` +
      `See the [onboarding guide|${SAGE_BOT_DOCS_LINKS.ONBOARDING_CREDENTIALS}] for instructions.`
    );
  }
  return null;
};

/**
 * Validate a ticket before processing
 * Runs all validation checks and collects errors
 * @param ticketData - The parsed ticket data to validate
 * @returns Validation result with isValid flag and any errors
 */
export const validateTicket = async (
  ticketData: ParsedTicketData
): Promise<ValidationResult> => {
  const errors: string[] = [];

  // Check for repo label
  const repoError = validateRepositoryLabel(ticketData);
  if (repoError) {
    errors.push(repoError);
  }

  // Check for assignee
  const assigneeError = validateAssignee(ticketData);
  if (assigneeError) {
    errors.push(assigneeError);
  } else if (ticketData.assigneeEmail) {
    // Only check credentials if assignee exists
    const credentialsError = await validateCredentials(
      ticketData.assigneeEmail
    );
    if (credentialsError) {
      errors.push(credentialsError);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
