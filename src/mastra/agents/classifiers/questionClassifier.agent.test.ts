// Replace with evals
// import { z } from 'zod';
// import {
//   questionClassifierAgent,
//   outputSchema,
// } from './questionClassifierAgent';

// const evergreenQuestions = [
//   'What is the current test status?',
//   'What is the current task status?',
//   'How many tests have been run?',
//   'Has this task failed before?',
// ];

// const logQuestions = [
//   'Why did the test fail?',
//   'What does this log mean?',
//   'What is the error message?',
//   'What is the root cause of the error?',
// ];

// const combinationQuestions = [
//   'What is the current test status and why did it fail?',
//   'What is the current task status and what is the error message for this log?',
//   'Has this task failed before with this same error message?',
// ];

// const irrelevantQuestions = [
//   'What is the weather in Tokyo?',
//   'What is the capital of France?',
//   'What is the meaning of life?',
// ];
// describe('questionClassifierAgent', () => {
//   describe('Evergreen Questions', async () => {
//     evergreenQuestions.forEach(question => {
//       it(`should classify ${question} into a category`, async () => {
//         const result = await questionClassifierAgent.generate(question);
//         const output = result.object as z.infer<typeof outputSchema>;
//         expect(output.questionClass).toBe('EVERGREEN');
//         expect(output.nextAction).toBe('USE_EVERGREEN_AGENT');
//         expect(output.confidence).toBeGreaterThan(0.8);
//         expect(output.originalQuestion).toBe(question);
//       });
//     });
//   });
//   describe('Log Questions', async () => {
//     logQuestions.forEach(question => {
//       it(`should classify ${question} into a category`, async () => {
//         const result = await questionClassifierAgent.generate(question);
//         const output = result.object as z.infer<typeof outputSchema>;
//         expect(output.questionClass).toBe('LOG');
//         expect(output.nextAction).toBe('USE_LOG_ANALYSIS_AGENT');
//         expect(output.confidence).toBeGreaterThan(0.8);
//         expect(output.originalQuestion).toBe(question);
//       });
//     });
//   });
//   describe('Combination Questions', async () => {
//     combinationQuestions.forEach(question => {
//       it(`should classify ${question} into a category`, async () => {
//         const result = await questionClassifierAgent.generate(question);
//         const output = result.object as z.infer<typeof outputSchema>;
//         expect(output.questionClass).toBe('COMBINATION');
//         expect(output.nextAction).toBe('USE_COMBINATION_ANALYSIS');
//         expect(output.confidence).toBeGreaterThan(0.5);
//         expect(output.originalQuestion).toBe(question);
//       });
//     });
//   });
//   describe('Irrelevant Questions', async () => {
//     irrelevantQuestions.forEach(question => {
//       it(`should classify ${question} into a category`, async () => {
//         const result = await questionClassifierAgent.generate(question);
//         const output = result.object as z.infer<typeof outputSchema>;
//         expect(output.questionClass).toBe('IRRELEVANT');
//         expect(output.nextAction).toBe('DO_NOT_ANSWER');
//         expect(output.confidence).toBeGreaterThan(0.8);
//         expect(output.originalQuestion).toBe(question);
//       });
//     });
//   });
// });
