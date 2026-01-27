import { VoyageClientError, generateEmbedding, generateEmbeddings } from '.';

const { mockEmbed } = vi.hoisted(() => ({
  mockEmbed: vi.fn(),
}));

vi.mock('voyageai', () => ({
  VoyageAIClient: vi.fn().mockImplementation(() => ({
    embed: mockEmbed,
  })),
}));

vi.mock('@/config', () => ({
  config: {
    aiModels: {
      voyage: {
        apiKey: 'test-api-key',
        defaultModel: 'voyage-3',
      },
    },
  },
}));

describe('Voyage Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateEmbedding', () => {
    it('generates embedding for a single text', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      mockEmbed.mockResolvedValueOnce({
        data: [{ embedding: mockEmbedding }],
      });

      const result = await generateEmbedding('test question');

      expect(result).toEqual(mockEmbedding);
      expect(mockEmbed).toHaveBeenCalledWith({
        input: 'test question',
        model: 'voyage-3',
      });
    });

    it('throws VoyageClientError when no embedding is returned', async () => {
      mockEmbed.mockResolvedValue({
        data: [{ embedding: null }],
      });

      await expect(generateEmbedding('test question')).rejects.toThrow(
        VoyageClientError
      );
      await expect(generateEmbedding('test question')).rejects.toThrow(
        'No embedding returned from Voyage API'
      );
    });

    it('throws VoyageClientError when API call fails', async () => {
      mockEmbed.mockRejectedValue(new Error('API rate limited'));

      await expect(generateEmbedding('test question')).rejects.toThrow(
        VoyageClientError
      );
      await expect(generateEmbedding('test question')).rejects.toThrow(
        'Failed to generate embedding: API rate limited'
      );
    });
  });

  describe('generateEmbeddings', () => {
    it('generates embeddings for multiple texts', async () => {
      const mockEmbeddings = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ];
      mockEmbed.mockResolvedValueOnce({
        data: [
          { embedding: mockEmbeddings[0] },
          { embedding: mockEmbeddings[1] },
        ],
      });

      const result = await generateEmbeddings(['question 1', 'question 2']);

      expect(result).toEqual(mockEmbeddings);
      expect(mockEmbed).toHaveBeenCalledWith({
        input: ['question 1', 'question 2'],
        model: 'voyage-3',
      });
    });

    it('throws VoyageClientError when no data is returned', async () => {
      mockEmbed.mockResolvedValue({
        data: null,
      });

      await expect(
        generateEmbeddings(['question 1', 'question 2'])
      ).rejects.toThrow(VoyageClientError);
      await expect(
        generateEmbeddings(['question 1', 'question 2'])
      ).rejects.toThrow('No embeddings returned from Voyage API');
    });

    it('throws VoyageClientError when embedding count does not match', async () => {
      mockEmbed.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      });

      await expect(
        generateEmbeddings(['question 1', 'question 2'])
      ).rejects.toThrow(VoyageClientError);
      await expect(
        generateEmbeddings(['question 1', 'question 2'])
      ).rejects.toThrow('Expected 2 embeddings but received 1');
    });

    it('throws VoyageClientError when API call fails', async () => {
      mockEmbed.mockRejectedValue(new Error('Connection timeout'));

      await expect(
        generateEmbeddings(['question 1', 'question 2'])
      ).rejects.toThrow(VoyageClientError);
      await expect(
        generateEmbeddings(['question 1', 'question 2'])
      ).rejects.toThrow('Failed to generate embeddings: Connection timeout');
    });
  });

  describe('VoyageClientError', () => {
    it('has correct name and properties', () => {
      const error = new VoyageClientError('Test error', 'TEST_CODE');

      expect(error.name).toBe('VoyageClientError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
    });

    it('includes cause when provided', () => {
      const cause = new Error('Original error');
      const error = new VoyageClientError('Wrapper error', 'WRAP', cause);

      expect(error.cause).toBe(cause);
    });
  });
});
