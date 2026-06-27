export const defaultDeepSeekModel = 'deepseek-v4-flash';
export const defaultDeepSeekEndpoint = 'https://api.deepseek.com/chat/completions';

export function createDeepSeekRequestBody({ model = defaultDeepSeekModel, messages, extra = {} }) {
  return {
    model: model || defaultDeepSeekModel,
    messages,
    thinking: { type: 'enabled' },
    reasoning_effort: 'high',
    stream: false,
    ...extra
  };
}
