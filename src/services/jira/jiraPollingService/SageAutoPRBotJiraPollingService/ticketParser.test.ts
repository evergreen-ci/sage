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
      targetRef: null,
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
    expect(result.targetRef).toBeNull();
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
    expect(result.targetRef).toBeNull();
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
    expect(result.targetRef).toBeNull();
  });

  it('parses target repository with inline ref from labels', () => {
    const issue = {
      key: 'PROJ-102',
      fields: {
        summary: 'Test with ref',
        description: 'Description',
        assignee: { emailAddress: 'test@example.com', displayName: 'Test' },
        labels: ['sage-bot', 'repo:mongodb/mongo-tools@feature-branch'],
      },
    };

    const result = extractTicketData(issue);

    expect(result.targetRepository).toBe('mongodb/mongo-tools');
    expect(result.targetRef).toBe('feature-branch');
  });

  it('parses ref with slashes (e.g., feature/branch-name)', () => {
    const issue = {
      key: 'PROJ-103',
      fields: {
        summary: 'Test with nested ref',
        description: 'Description',
        assignee: null,
        labels: ['repo:org/repo@feature/my-branch'],
      },
    };

    const result = extractTicketData(issue);

    expect(result.targetRepository).toBe('org/repo');
    expect(result.targetRef).toBe('feature/my-branch');
  });

  it('parses ref with dots and dashes', () => {
    const issue = {
      key: 'PROJ-104',
      fields: {
        summary: 'Test with version-like ref',
        description: 'Description',
        assignee: null,
        labels: ['repo:mongodb/test-repo@v1.2.3-beta'],
      },
    };

    const result = extractTicketData(issue);

    expect(result.targetRepository).toBe('mongodb/test-repo');
    expect(result.targetRef).toBe('v1.2.3-beta');
  });
});
