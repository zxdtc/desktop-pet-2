import assert from 'node:assert/strict';
import { createDeepSeekRequestBody } from '../src/shared/deepSeekClient.js';

const body = createDeepSeekRequestBody({
  model: 'deepseek-v4-flash',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' }
  ]
});

assert.deepEqual(body, {
  model: 'deepseek-v4-flash',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' }
  ],
  thinking: { type: 'enabled' },
  reasoning_effort: 'high',
  stream: false
});

console.log('DeepSeek request body ok');
