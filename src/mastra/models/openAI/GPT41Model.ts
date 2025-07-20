import GPTModel from '../base/BaseModel';

// Create and export a GPT-4.1 instance
const gpt41 = new GPTModel('gpt-4.1').getModel();
const gpt41Nano = new GPTModel('gpt-4.1-nano').getModel();

export { gpt41, gpt41Nano };
