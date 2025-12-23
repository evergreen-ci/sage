import { extractTicketData } from './ticketParser';

describe('extractTicketData', () => {
  it('extracts all fields from issue', () => {
    const issue = {
      key: 'PROJ-123',
      fields: {
        summary: 'Test summary',
        description: 'Description text',
        assignee: { emailAddress: 'user@example.com', displayName: 'User' },
        labels: ['sage-bot', 'repo:mongodb/test'],
      },
    };

    const result = extractTicketData(issue);

    expect(result).toEqual({
      ticketKey: 'PROJ-123',
      summary: 'Test summary',
      description: 'Description text',
      assigneeEmail: 'user@example.com',
      targetRepository: 'mongodb/test',
      labels: ['sage-bot', 'repo:mongodb/test'],
    });
  });

  it('handles missing assignee', () => {
    const issue = {
      key: 'PROJ-456',
      fields: {
        summary: 'No assignee',
        description: null,
        assignee: null,
        labels: [],
      },
    };

    const result = extractTicketData(issue);

    expect(result.assigneeEmail).toBeNull();
    expect(result.targetRepository).toBeNull();
    expect(result.labels).toEqual([]);
  });

  it('handles empty labels array', () => {
    const issue = {
      key: 'PROJ-789',
      fields: {
        summary: 'Test',
        description: 'Description',
        assignee: { emailAddress: 'test@example.com', displayName: 'Test' },
        labels: [],
      },
    };

    const result = extractTicketData(issue);

    expect(result.labels).toEqual([]);
    expect(result.targetRepository).toBeNull();
  });

  it('parses target repository from labels', () => {
    const issue = {
      key: 'PROJ-101',
      fields: {
        summary: 'Test',
        description: 'Description',
        assignee: null,
        labels: ['some-label', 'repo:org/project', 'another-label'],
      },
    };

    const result = extractTicketData(issue);

    expect(result.targetRepository).toBe('org/project');
  });
});
