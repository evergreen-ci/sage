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
      targetRepositories: [{ repository: 'mongodb/test', ref: null }],
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
    expect(result.targetRepositories).toEqual([]);
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
    expect(result.targetRepositories).toEqual([]);
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
    expect(result.targetRepositories).toEqual([
      { repository: 'org/project', ref: null },
    ]);
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
    expect(result.targetRepositories).toEqual([
      { repository: 'mongodb/mongo-tools', ref: 'feature-branch' },
    ]);
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

  it('parses multiple repo labels into targetRepositories', () => {
    const issue = {
      key: 'PROJ-MULTI',
      fields: {
        summary: 'Multi-repo test',
        description: 'Description',
        assignee: { emailAddress: 'user@example.com', displayName: 'User' },
        labels: ['sage-bot', 'repo:mongodb/repo1', 'repo:mongodb/repo2@main'],
      },
    };

    const result = extractTicketData(issue);

    // targetRepository and targetRef reflect the first repo label
    expect(result.targetRepository).toBe('mongodb/repo1');
    expect(result.targetRef).toBeNull();

    // targetRepositories includes all repo labels
    expect(result.targetRepositories).toEqual([
      { repository: 'mongodb/repo1', ref: null },
      { repository: 'mongodb/repo2', ref: 'main' },
    ]);
  });
});
