import { createScoreChecker, ToolUsage, ToolUsageMode } from './scorers';

describe('createScoreChecker', () => {
  it('should create a score checker', () => {
    const scoreThresholds = {
      Factuality: 0.6,
      ToolUsage: 1,
    };
    const scores = {
      Factuality: 1,
      ToolUsage: 1,
    };
    const detailedErrorMessages = createScoreChecker(scores, scoreThresholds);
    expect(detailedErrorMessages).toEqual([]);
  });
  it('should return an error message if the score is below the threshold', () => {
    const scoreThresholds = {
      Factuality: 0.8,
      ToolUsage: 1,
    };
    const scores = {
      Factuality: 0.6,
      ToolUsage: 0,
    };
    const detailedErrorMessages = createScoreChecker(scores, scoreThresholds);
    expect(detailedErrorMessages).toEqual([
      'Factuality score 0.6 is below threshold 0.8.',
      'ToolUsage score 0 is below threshold 1.',
    ]);
  });

  it('should return a single error message if the test is partially not met', () => {
    const scoreThresholds = {
      Factuality: 0.8,
      ToolUsage: 1,
    };
    const scores = {
      Factuality: 0.6,
      ToolUsage: 1,
    };
    const detailedErrorMessages = createScoreChecker(scores, scoreThresholds);
    expect(detailedErrorMessages).toEqual([
      'Factuality score 0.6 is below threshold 0.8.',
    ]);
  });

  it('if results are provided, it should return an error message with the expected and output', () => {
    const scoreThresholds = {
      Factuality: 0.8,
      ToolUsage: 1,
    };
    const scores = {
      Factuality: 0.6,
      ToolUsage: 1,
    };
    const results = {
      expected: {
        text: 'some correct output',
      },
      output: {
        text: 'some incorrect output',
        duration: 100,
      },
    };
    const detailedErrorMessages = createScoreChecker(
      scores,
      scoreThresholds,
      results
    );
    expect(detailedErrorMessages).toEqual([
      'Factuality score 0.6 is below threshold 0.8.\n Expected: {"text":"some correct output"}.\n Output: {"text":"some incorrect output"}.',
    ]);
  });
});

describe('toolUsage', () => {
  describe('exact match mode', () => {
    it('should return a score of 1 if the tools are used', () => {
      const toolUsageScorer = ToolUsage({
        output: ['tool1', 'tool2'],
        expected: ['tool1', 'tool2'],
        mode: ToolUsageMode.ExactMatch,
      });
      expect(toolUsageScorer).toEqual({
        name: 'ToolUsage',
        score: 1,
        metadata: {
          expected_tools: ['tool1', 'tool2'],
          actual_tools: ['tool1', 'tool2'],
          correct: true,
        },
      });
    });

    it('should return a score of 0 if the tools are not used', () => {
      const toolUsageScorer = ToolUsage({
        output: ['tool1', 'tool2'],
        expected: ['tool1', 'tool3'],
        mode: ToolUsageMode.ExactMatch,
      });
      expect(toolUsageScorer).toEqual({
        name: 'ToolUsage',
        score: 0,
        metadata: {
          expected_tools: ['tool1', 'tool3'],
          actual_tools: ['tool1', 'tool2'],
          correct: false,
        },
      });
    });
  });

  describe('subset mode', () => {
    it('should return a score of 1 if subset of tools are used', () => {
      const toolUsageScorer = ToolUsage({
        output: ['tool1', 'tool2', 'tool3'],
        expected: ['tool1'],
        mode: ToolUsageMode.Subset,
      });
      expect(toolUsageScorer).toEqual({
        name: 'ToolUsage',
        score: 1,
        metadata: {
          expected_tools: ['tool1'],
          actual_tools: ['tool1', 'tool2', 'tool3'],
          correct: true,
        },
      });
    });

    it('should return a score of 0 if subset of tools are not used', () => {
      const toolUsageScorer = ToolUsage({
        output: ['tool1', 'tool2'],
        expected: ['tool1', 'tool3'],
        mode: ToolUsageMode.Subset,
      });
      expect(toolUsageScorer).toEqual({
        name: 'ToolUsage',
        score: 0,
        metadata: {
          expected_tools: ['tool1', 'tool3'],
          actual_tools: ['tool1', 'tool2'],
          correct: false,
        },
      });
    });
  });
});
