import { Request, Response } from 'express';
import upsertQuestionOwnershipWithEmbeddingsRoute from './upsertQuestionOwnershipWithEmbeddings';

const { mockGenerateEmbeddings, mockVectorStoreUpsert } = vi.hoisted(() => ({
  mockGenerateEmbeddings: vi.fn(),
  mockVectorStoreUpsert: vi.fn(),
}));

vi.mock('@/mastra/utils/voyage', () => ({
  generateEmbeddings: mockGenerateEmbeddings,
}));

vi.mock('@/mastra/utils/memory', () => ({
  vectorStore: {
    upsert: mockVectorStoreUpsert,
  },
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

describe('upsertQuestionOwnershipWithEmbeddingsRoute', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      body: {
        mappings: [
          {
            question: 'How do I deploy to staging?',
            teamName: 'Release Engineering',
            teamId: 'team-1',
          },
        ],
      },
    };

    mockRes = {
      locals: { requestId: 'test-request-id' },
      json: jsonMock,
      status: statusMock,
    };
  });

  describe('validation', () => {
    it('returns 400 for missing mappings', async () => {
      mockReq.body = {};

      await upsertQuestionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Invalid request body',
      });
    });

    it('returns 400 for empty mappings array', async () => {
      mockReq.body = { mappings: [] };

      await upsertQuestionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Invalid request body',
      });
    });

    it('returns 400 for mappings exceeding batch size', async () => {
      mockReq.body = {
        mappings: Array(101)
          .fill(null)
          .map((_, i) => ({
            question: `Question ${i}`,
            teamName: 'Team',
            teamId: 'team-id',
          })),
      };

      await upsertQuestionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Invalid request body',
      });
    });

    it('returns 400 for question exceeding max length', async () => {
      mockReq.body = {
        mappings: [
          {
            question: 'a'.repeat(2001),
            teamName: 'Team',
            teamId: 'team-id',
          },
        ],
      };

      await upsertQuestionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Invalid request body',
      });
    });

    it('returns 400 for empty question', async () => {
      mockReq.body = {
        mappings: [
          {
            question: '',
            teamName: 'Team',
            teamId: 'team-id',
          },
        ],
      };

      await upsertQuestionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Invalid request body',
      });
    });

    it('returns 400 for missing teamName', async () => {
      mockReq.body = {
        mappings: [
          {
            question: 'How do I deploy?',
            teamId: 'team-id',
          },
        ],
      };

      await upsertQuestionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Invalid request body',
      });
    });

    it('returns 400 for missing teamId', async () => {
      mockReq.body = {
        mappings: [
          {
            question: 'How do I deploy?',
            teamName: 'Team',
          },
        ],
      };

      await upsertQuestionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Invalid request body',
      });
    });

    it('trims whitespace from questions', async () => {
      mockReq.body = {
        mappings: [
          {
            question: '  How do I deploy?  ',
            teamName: 'Team',
            teamId: 'team-id',
          },
        ],
      };
      mockGenerateEmbeddings.mockResolvedValueOnce([[0.1, 0.2, 0.3]]);
      mockVectorStoreUpsert.mockResolvedValueOnce(undefined);

      await upsertQuestionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockGenerateEmbeddings).toHaveBeenCalledWith(['How do I deploy?']);
    });
  });

  describe('successful upsert', () => {
    it('upserts single mapping successfully', async () => {
      mockGenerateEmbeddings.mockResolvedValueOnce([[0.1, 0.2, 0.3]]);
      mockVectorStoreUpsert.mockResolvedValueOnce(undefined);

      await upsertQuestionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockGenerateEmbeddings).toHaveBeenCalledWith([
        'How do I deploy to staging?',
      ]);
      expect(mockVectorStoreUpsert).toHaveBeenCalledWith({
        indexName: 'questionOwnership',
        vectors: [[0.1, 0.2, 0.3]],
        metadata: [
          {
            question: 'How do I deploy to staging?',
            teamName: 'Release Engineering',
            teamId: 'team-1',
          },
        ],
        ids: [expect.any(String)],
      });
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Successfully upserted question ownership mappings',
        count: 1,
      });
    });

    it('upserts multiple mappings successfully', async () => {
      mockReq.body = {
        mappings: [
          {
            question: 'How do I deploy to staging?',
            teamName: 'Release Engineering',
            teamId: 'team-1',
          },
          {
            question: 'How do I run tests?',
            teamName: 'DevProd Platform',
            teamId: 'team-2',
          },
        ],
      };
      mockGenerateEmbeddings.mockResolvedValueOnce([
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ]);
      mockVectorStoreUpsert.mockResolvedValueOnce(undefined);

      await upsertQuestionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockGenerateEmbeddings).toHaveBeenCalledWith([
        'How do I deploy to staging?',
        'How do I run tests?',
      ]);
      expect(mockVectorStoreUpsert).toHaveBeenCalledWith({
        indexName: 'questionOwnership',
        vectors: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ],
        metadata: [
          {
            question: 'How do I deploy to staging?',
            teamName: 'Release Engineering',
            teamId: 'team-1',
          },
          {
            question: 'How do I run tests?',
            teamName: 'DevProd Platform',
            teamId: 'team-2',
          },
        ],
        ids: [expect.any(String), expect.any(String)],
      });
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Successfully upserted question ownership mappings',
        count: 2,
      });
    });

    it('generates base64 IDs for idempotency', async () => {
      mockGenerateEmbeddings.mockResolvedValueOnce([[0.1, 0.2, 0.3]]);
      mockVectorStoreUpsert.mockResolvedValueOnce(undefined);

      await upsertQuestionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      const expectedId = Buffer.from('How do I deploy to staging?').toString(
        'base64'
      );
      expect(mockVectorStoreUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          ids: [expectedId],
        })
      );
    });
  });

  describe('error handling', () => {
    it('returns 500 when embedding generation fails', async () => {
      mockGenerateEmbeddings.mockRejectedValueOnce(new Error('API error'));

      await upsertQuestionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Error processing upsert question ownership request',
      });
    });

    it('returns 500 when vector store upsert fails', async () => {
      mockGenerateEmbeddings.mockResolvedValueOnce([[0.1, 0.2, 0.3]]);
      mockVectorStoreUpsert.mockRejectedValueOnce(new Error('Database error'));

      await upsertQuestionOwnershipWithEmbeddingsRoute(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Error processing upsert question ownership request',
      });
    });
  });
});
