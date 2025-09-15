import { createScoreChecker, toolUsage } from './scorers';

describe('createScoreChecker', () => {
  it('should create a score checker', () => {
    const scoreChecker = createScoreChecker({
      Factuality: 0.7,
      ToolUsage: 0.8,
    });
    const scores = {
      Factuality: 1,
      ToolUsage: 1,
    };
    const detailedErrorMessages = scoreChecker(scores);
    expect(detailedErrorMessages).toEqual([]);
  });
  it('should return an error message if the score is below the threshold', () => {
    const scoreChecker = createScoreChecker({
      Factuality: 0.7,
      ToolUsage: 0.8,
    });
    const scores = {
      Factuality: 0.6,
      ToolUsage: 0.7,
    };
    const detailedErrorMessages = scoreChecker(scores);
    expect(detailedErrorMessages).toEqual([
      'Factuality score 0.6 is below threshold 0.7.',
      'ToolUsage score 0.7 is below threshold 0.8.',
    ]);
  });
  it('should return an error message if the test is partially not met', () => {
    const scoreChecker = createScoreChecker({
      Factuality: 0.7,
      ToolUsage: 0.8,
    });
    const scores = {
      Factuality: 0.6,
      ToolUsage: 1,
    };
    const detailedErrorMessages = scoreChecker(scores);
    expect(detailedErrorMessages).toEqual([
      'Factuality score 0.6 is below threshold 0.7.',
    ]);
  });
  it('if results are provided, it should return an error message with the expected and output', () => {
    const scoreChecker = createScoreChecker({
      Factuality: 0.7,
      ToolUsage: 0.8,
    });
    const scores = {
      Factuality: 0.6,
      ToolUsage: 1,
    };
    const results = {
      Factuality: {
        expected: 'some correct output',
        output: 'some incorrect output',
      },
    };
    const detailedErrorMessages = scoreChecker(scores, results);
    expect(detailedErrorMessages).toEqual([
      'Factuality score 0.6 is below threshold 0.7.\n Expected: "some correct output".\n Output: "some incorrect output".',
    ]);
  });
});

describe('toolUsage', () => {
  it('should create a tool usage scorer', () => {
    const toolUsageScorer = toolUsage({
      output: ['tool1', 'tool2'],
      expected: ['tool1', 'tool2'],
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
    const toolUsageScorer = toolUsage({
      output: ['tool1', 'tool2'],
      expected: ['tool1', 'tool3'],
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
