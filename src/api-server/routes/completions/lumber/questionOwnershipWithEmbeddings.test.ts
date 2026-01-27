import { Request, Response } from 'express';
import questionOwnershipWithEmbeddingsRoute from './questionOwnershipWithEmbeddings';

const {
  mockGenerate,
  mockGenerateEmbedding,
  mockGetAgent,
  mockVectorStoreQuery,
} = vi.hoisted(() => ({
  mockGenerateEmbedding: vi.fn(),
  mockVectorStoreQuery: vi.fn(),
  mockGetAgent: vi.fn(),
  mockGenerate: vi.fn(),
}));

vi.mock('@/mastra/utils/voyage', () => ({
  generateEmbedding: mockGenerateEmbedding,
}));

vi.mock('@/mastra/utils/memory', () => ({
  vectorStore: {
    query: mockVectorStoreQuery,
  },
}));

vi.mock('@/mastra', () => ({
  mastra: {
    getAgent: mockGetAgent,
  },
}));

vi.mock('@/mastra/agents/questionOwnershipAgent', () => ({
  questionOwnershipOutputSchema: {},
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/config', () => ({
  config: {
    questionOwnership: {
      indexName: 'questionOwnership',
      embeddingDimension: 1024,
      similarityThreshold: 0.75,
    },
  },
}));

describe('questionOwnershipWithEmbeddingsRoute', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      body: { question: 'How do I deploy to staging?' },
    };

    mockRes = {
      locals: { requestId: 'test-request-id' },
      json: jsonMock,
      status: statusMock,
    };
  });

  describe('validation', () => {
    it('returns 400 for missing question', async () => {
      mockReq.body = {};

      await questionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Invalid request body',
      });
    });

    it('returns 400 for empty question', async () => {
      mockReq.body = { question: '' };

      await questionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Invalid request body',
      });
    });

    it('returns 400 for question exceeding max length', async () => {
      mockReq.body = { question: 'a'.repeat(2001) };

      await questionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Invalid request body',
      });
    });

    it('trims whitespace from question', async () => {
      mockReq.body = { question: '  How do I deploy?  ' };
      mockGenerateEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
      mockVectorStoreQuery.mockResolvedValueOnce([
        {
          score: 0.9,
          metadata: { teamId: 'team-1', teamName: 'Release Engineering' },
        },
      ]);

      await questionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockGenerateEmbedding).toHaveBeenCalledWith('How do I deploy?');
    });
  });

  describe('embedding match', () => {
    it('returns team from embeddings when score is above threshold', async () => {
      mockGenerateEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
      mockVectorStoreQuery.mockResolvedValueOnce([
        {
          score: 0.9,
          metadata: { teamId: 'team-1', teamName: 'Release Engineering' },
        },
      ]);

      await questionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(jsonMock).toHaveBeenCalledWith({
        teamId: 'team-1',
        teamName: 'Release Engineering',
        reasoning: expect.stringContaining('embedding similarity'),
      });
      expect(mockGetAgent).not.toHaveBeenCalled();
    });

    it('falls back to agent when score is below threshold', async () => {
      mockGenerateEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
      mockVectorStoreQuery.mockResolvedValueOnce([
        {
          score: 0.5,
          metadata: { teamId: 'team-1', teamName: 'Release Engineering' },
        },
      ]);

      const mockAgent = {
        getDefaultOptions: vi.fn().mockResolvedValue({}),
        generate: mockGenerate.mockResolvedValueOnce({
          object: {
            teamId: 'team-2',
            teamName: 'DevProd Platform',
            reasoning: 'Agent determined team',
          },
        }),
      };
      mockGetAgent.mockReturnValueOnce(mockAgent);

      await questionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockGetAgent).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        teamId: 'team-2',
        teamName: 'DevProd Platform',
        reasoning: expect.stringContaining('agent fallback'),
      });
    });

    it('falls back to agent when no embedding matches found', async () => {
      mockGenerateEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
      mockVectorStoreQuery.mockResolvedValueOnce([]);

      const mockAgent = {
        getDefaultOptions: vi.fn().mockResolvedValue({}),
        generate: mockGenerate.mockResolvedValueOnce({
          object: {
            teamId: 'team-3',
            teamName: 'Evergreen',
            reasoning: 'No embeddings found',
          },
        }),
      };
      mockGetAgent.mockReturnValueOnce(mockAgent);

      await questionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockGetAgent).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        teamId: 'team-3',
        teamName: 'Evergreen',
        reasoning: expect.stringContaining('agent fallback'),
      });
    });
  });

  describe('error handling', () => {
    it('returns 500 when agent is not found', async () => {
      mockGenerateEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
      mockVectorStoreQuery.mockResolvedValueOnce([]);
      mockGetAgent.mockReturnValueOnce(null);

      await questionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'question ownership agent not configured',
      });
    });

    it('returns 500 when embedding generation fails', async () => {
      mockGenerateEmbedding.mockRejectedValueOnce(new Error('API error'));

      await questionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Error processing question ownership request',
      });
    });

    it('returns 500 when agent returns no structured output', async () => {
      mockGenerateEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
      mockVectorStoreQuery.mockResolvedValueOnce([]);

      const mockAgent = {
        getDefaultOptions: vi.fn().mockResolvedValue({}),
        generate: mockGenerate.mockResolvedValueOnce({
          object: null,
          text: 'Some text',
        }),
      };
      mockGetAgent.mockReturnValueOnce(mockAgent);

      await questionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Invalid agent response format',
      });
    });
  });
});
