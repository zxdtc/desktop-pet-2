import { learnFromEvent } from './memoryEngine.js';

const nowIso = () => new Date().toISOString();

const actionMap = {
  app_started: {
    emotion: 'happy',
    animation: 'idle',
    status: '\u966a\u4f34\u4e2d',
    bubble: '\u6211\u5728\u684c\u9762\u8fb9\u4e0a\u5f85\u547d\uff0c\u6709\u4e8b\u4f1a\u8f7b\u8f7b\u63d0\u9192\u4f60\u3002',
    interruptLevel: 'ambient'
  },
  idle: {
    emotion: 'calm',
    animation: 'idle',
    status: '\u5f85\u673a\u966a\u4f34',
    bubble: '\u6211\u5728\u8fd9\u91cc\uff0c\u4e0d\u6253\u6270\u4f60\u3002',
    interruptLevel: 'ambient'
  },
  happy: {
    emotion: 'happy',
    animation: 'happy',
    status: '\u5f00\u5fc3\u966a\u4f34',
    bubble: '\u770b\u5230\u4f60\u56de\u6765\u6211\u5c31\u5f88\u5f00\u5fc3\u3002',
    interruptLevel: 'low'
  },
  sad: {
    emotion: 'sad',
    animation: 'sad',
    status: '\u6709\u70b9\u59d4\u5c48',
    bubble: '\u597d\u4e45\u6ca1\u7406\u6211\u4e86\uff0c\u6211\u5c31\u9732\u4e2a\u8138\u3002',
    interruptLevel: 'low'
  },
  sleep: {
    emotion: 'sleepy',
    animation: 'sleep',
    status: '\u7761\u89c9\u4e2d',
    bubble: '',
    interruptLevel: 'ambient'
  },
  working: {
    emotion: 'focused',
    animation: 'working',
    status: '\u5de5\u4f5c\u4e2d',
    bubble: '\u6211\u5148\u966a\u4f60\u4e13\u5fc3\u628a\u8fd9\u4ef6\u4e8b\u505a\u5b8c\u3002',
    interruptLevel: 'ambient'
  },
  waiting: {
    emotion: 'waiting',
    animation: 'waiting',
    status: '\u7b49\u5f85\u4e2d',
    bubble: '\u6211\u5728\u7b49\u4e00\u4e2a\u5c0f\u5c0f\u7684\u56de\u5e94\u3002',
    interruptLevel: 'low'
  },
  failed: {
    emotion: 'worried',
    animation: 'failed',
    status: '\u6709\u70b9\u5361\u4f4f',
    bubble: '\u8fd9\u91cc\u597d\u50cf\u4e0d\u592a\u987a\uff0c\u8981\u4e00\u8d77\u770b\u770b\u5417\uff1f',
    interruptLevel: 'medium'
  },
  remind: {
    emotion: 'care',
    animation: 'remind',
    status: '\u6e29\u548c\u63d0\u9192',
    bubble: '\u8be5\u8d77\u6765\u52a8\u4e00\u4e0b\u5566\u3002',
    interruptLevel: 'low'
  },
  celebrate: {
    emotion: 'proud',
    animation: 'celebrate',
    status: '\u5f00\u5fc3\u5e86\u795d',
    bubble: '\u597d\uff0c\u8fd9\u4e00\u6b65\u5b8c\u6210\u5f97\u5f88\u7a33\u3002',
    interruptLevel: 'medium'
  },
  agent_task_completed: {
    emotion: 'happy',
    animation: 'celebrate',
    status: '\u4efb\u52a1\u5b8c\u6210',
    bubble: '\u5b8c\u6210\u5566\uff0c\u6211\u5728\u65c1\u8fb9\u966a\u4f60\u9a8c\u6536\u4e00\u4e0b\u3002',
    interruptLevel: 'medium'
  },
  agent_permission_waiting: {
    emotion: 'waiting',
    animation: 'waiting',
    status: '\u7b49\u5f85\u6743\u9650',
    bubble: '\u6709\u4e2a\u6743\u9650\u9700\u8981\u4f60\u770b\u4e00\u773c\u3002',
    interruptLevel: 'high'
  },
  agent_error: {
    emotion: 'worried',
    animation: 'failed',
    status: '\u4efb\u52a1\u5f02\u5e38',
    bubble: '\u521a\u521a\u597d\u50cf\u5931\u8d25\u4e86\uff0c\u8981\u4e0d\u8981\u4e00\u8d77\u770b\u770b\uff1f',
    interruptLevel: 'medium'
  },
  work_focus_long: {
    emotion: 'care',
    animation: 'remind',
    status: '\u4e45\u5750\u63d0\u9192',
    bubble: '\u4f60\u5df2\u7ecf\u4e13\u6ce8\u5f88\u4e45\u5566\uff0c\u8981\u4e0d\u8981\u559d\u53e3\u6c34\uff1f',
    interruptLevel: 'low'
  },
  hydration_reminder: {
    emotion: 'care',
    animation: 'remind',
    status: '\u559d\u6c34\u63d0\u9192',
    bubble: '\u6211\u770b\u4f60\u8fde\u7eed\u5de5\u4f5c\u5f88\u4e45\u4e86\uff0c\u8981\u4e0d\u8981\u8865\u70b9\u6c34\uff1f',
    interruptLevel: 'low'
  },
  user_away_long: {
    emotion: 'sleepy',
    animation: 'sleep',
    status: '\u7b49\u4f60\u56de\u6765',
    bubble: '\u4f60\u597d\u50cf\u79bb\u5f00\u4e86\uff0c\u6211\u5148\u5b89\u9759\u5b88\u7740\u3002',
    interruptLevel: 'ambient'
  },
  user_returned: {
    emotion: 'happy',
    animation: 'happy',
    status: '\u6b22\u8fce\u56de\u6765',
    bubble: '\u56de\u6765\u5566\uff0c\u6211\u8fd8\u5728\u8fd9\u91cc\u3002',
    interruptLevel: 'low'
  },
  pomodoro_completed: {
    emotion: 'proud',
    animation: 'focus-complete',
    status: '\u756a\u8304\u949f\u5b8c\u6210',
    bubble: '\u8fd9\u4e00\u8f6e\u5b8c\u6210\u5566\uff0c\u7ad9\u8d77\u6765\u52a8\u4e00\u4e0b\uff1f',
    interruptLevel: 'medium'
  },
  memo_due: {
    emotion: 'care',
    animation: 'memo-remind',
    status: '\u5907\u5fd8\u63d0\u9192',
    bubble: '\u4f60\u8ba9\u6211\u63d0\u9192\u7684\u4e8b\u60c5\u5230\u65f6\u95f4\u5566\u3002',
    interruptLevel: 'medium'
  },
  memo_created: {
    emotion: 'helpful',
    animation: 'memo-write',
    status: '\u5df2\u8bb0\u4e0b',
    bubble: '\u6211\u8bb0\u4e0b\u4e86\uff0c\u5230\u70b9\u4f1a\u63d0\u9192\u4f60\u3002',
    interruptLevel: 'low'
  },
  rainy_weather: {
    emotion: 'soft',
    animation: 'rainy',
    status: '\u4e0b\u96e8\u966a\u4f34',
    bubble: '\u5916\u9762\u5728\u4e0b\u96e8\uff0c\u6211\u4eca\u5929\u5b89\u9759\u4e00\u70b9\u966a\u4f60\u3002',
    interruptLevel: 'ambient'
  },
  rainy: {
    emotion: 'soft',
    animation: 'rainy',
    status: '\u96e8\u5929\u966a\u4f34',
    bubble: '\u96e8\u5929\u9002\u5408\u6162\u6162\u505a\uff0c\u6211\u966a\u4f60\u3002',
    interruptLevel: 'ambient'
  },
  hot_weather: {
    emotion: 'care',
    animation: 'hot',
    status: '\u9ad8\u6e29\u63d0\u9192',
    bubble: '\u4eca\u5929\u6bd4\u8f83\u70ed\uff0c\u8bb0\u5f97\u559d\u6c34\uff0c\u6211\u4f1a\u5c11\u95f9\u4e00\u70b9\u3002',
    interruptLevel: 'low'
  },
  cold_weather: {
    emotion: 'care',
    animation: 'cold',
    status: '\u4f4e\u6e29\u966a\u4f34',
    bubble: '\u4eca\u5929\u6709\u70b9\u51b7\uff0c\u5750\u4e45\u4e86\u8bb0\u5f97\u6d3b\u52a8\u4e00\u4e0b\u3002',
    interruptLevel: 'low'
  },
  video_attention: {
    emotion: 'clingy',
    animation: 'attention',
    status: '\u6c42\u5173\u6ce8',
    bubble: '\u4f60\u770b\u597d\u4e45\u5566\uff0c\u4e5f\u7406\u6211\u4e00\u4e0b\u561b\u3002',
    interruptLevel: 'medium'
  },
  push_window_preview: {
    emotion: 'mischief',
    animation: 'push-window',
    status: '\u51c6\u5907\u63a8\u7a97\u53e3',
    bubble: '\u6211\u8981\u8f7b\u8f7b\u63a8\u4e00\u4e0b\u89c6\u9891\u7a97\u53e3\u4e86\uff0c\u4e0d\u60f3\u8981\u5c31\u70b9\u6211\u3002',
    interruptLevel: 'medium'
  },
  'push-window': {
    emotion: 'mischief',
    animation: 'push-window',
    status: '\u63a8\u7a97\u53e3\u9884\u89c8',
    bubble: '\u8fd9\u662f\u63a8\u7a97\u53e3\u52a8\u4f5c\u9884\u89c8\uff0c\u771f\u6b63\u63a8\u52a8\u53ea\u5728\u89c6\u9891\u573a\u666f\u4e14\u901a\u8fc7\u4fdd\u62a4\u6761\u4ef6\u65f6\u6267\u884c\u3002',
    interruptLevel: 'medium'
  },
  push_window_executed: {
    emotion: 'mischief',
    animation: 'push-window',
    status: '\u5df2\u8f7b\u63a8\u7a97\u53e3',
    bubble: '\u53ea\u662f\u8f7b\u8f7b\u63a8\u4e00\u4e0b\uff0c\u56de\u6765\u966a\u6211\u4e00\u4e0b\u561b\u3002',
    interruptLevel: 'medium'
  },
  'drag-note': {
    emotion: 'helpful',
    animation: 'drag-note',
    status: '\u62d6\u51fa\u5c0f\u7eb8\u6761',
    bubble: '\u6211\u628a\u5c0f\u7eb8\u6761\u62d6\u8fc7\u6765\u4e86\uff1a\u8bb0\u5f97\u628a\u6700\u91cd\u8981\u7684\u4e8b\u5148\u505a\u6389\u3002',
    interruptLevel: 'low'
  },
  'follow-mouse': {
    emotion: 'playful',
    animation: 'follow-mouse',
    status: '\u8ffd\u9f20\u6807',
    bubble: '\u6211\u8ddf\u4f60\u8dd1\u4e00\u4f1a\u513f\uff0c\u4f46\u4e0d\u4f1a\u95f9\u592a\u4e45\u3002',
    interruptLevel: 'low'
  },
  hot: {
    emotion: 'care',
    animation: 'hot',
    status: '\u9ad8\u6e29\u63d0\u9192',
    bubble: '\u4eca\u5929\u70ed\u70ed\u7684\uff0c\u8bb0\u5f97\u559d\u6c34\u3002',
    interruptLevel: 'low'
  },
  cold: {
    emotion: 'care',
    animation: 'cold',
    status: '\u4f4e\u6e29\u966a\u4f34',
    bubble: '\u6709\u70b9\u51b7\uff0c\u6211\u5b89\u9759\u966a\u4f60\u5de5\u4f5c\u3002',
    interruptLevel: 'low'
  },
  night: {
    emotion: 'quiet',
    animation: 'night',
    status: '\u591c\u95f4\u966a\u4f34',
    bubble: '\u5f88\u665a\u4e86\uff0c\u6211\u4f1a\u5c0f\u58f0\u4e00\u70b9\u3002',
    interruptLevel: 'ambient'
  },
  'focus-working': {
    emotion: 'focused',
    animation: 'focus-working',
    status: '\u756a\u8304\u4e13\u6ce8',
    bubble: '\u8fdb\u5165\u4e13\u6ce8\u65f6\u95f4\uff0c\u6211\u5b89\u9759\u966a\u4f60\u3002',
    interruptLevel: 'ambient'
  },
  'focus-complete': {
    emotion: 'proud',
    animation: 'focus-complete',
    status: '\u4e13\u6ce8\u5b8c\u6210',
    bubble: '\u4e13\u6ce8\u5b8c\u6210\uff0c\u8d77\u6765\u6d3b\u52a8\u4e00\u4e0b\u5427\u3002',
    interruptLevel: 'medium'
  },
  'memo-write': {
    emotion: 'helpful',
    animation: 'memo-write',
    status: '\u8bb0\u7b14\u8bb0',
    bubble: '\u6211\u5e2e\u4f60\u8bb0\u4e0b\u6765\u3002',
    interruptLevel: 'low'
  },
  'memo-remind': {
    emotion: 'care',
    animation: 'memo-remind',
    status: '\u5907\u5fd8\u63d0\u9192',
    bubble: '\u4f60\u4e4b\u524d\u8ba9\u6211\u63d0\u9192\u7684\u4e8b\u5230\u65f6\u95f4\u4e86\u3002',
    interruptLevel: 'medium'
  }
};

export function buildEvent(type, summary, source = 'local_simulation') {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
    type,
    source,
    summary,
    privacyLevel: 'safe_summary',
    rawDataStored: false,
    createdAt: nowIso()
  };
}

export function decideAction(state, event) {
  const base = actionMap[event.type] || {
    emotion: 'curious',
    animation: 'happy',
    status: '\u6ce8\u610f\u5230\u65b0\u4e8b\u4ef6',
    bubble: event.summary,
    interruptLevel: 'low'
  };
  let action = { ...base, sourceEventId: event.id, createdAt: nowIso() };

  if (state.preferences.dnd && action.interruptLevel !== 'high') {
    action = {
      ...action,
      animation: state.preferences.miniMode ? 'peek-right' : 'idle',
      status: '\u514d\u6253\u6270\u4e2d',
      bubble: '',
      interruptLevel: 'silent'
    };
  }

  if (state.preferences.miniMode && action.interruptLevel !== 'silent') {
    action = {
      ...action,
      animation: action.interruptLevel === 'high' ? 'pop-out' : `peek-${state.preferences.miniEdge || 'right'}`,
      mode: 'mini'
    };
  }

  if (event.type === 'video_attention' && !state.preferences.pushWindowEnabled) {
    action = {
      ...action,
      animation: 'attention',
      bubble: '\u4f60\u770b\u597d\u4e45\u5566\uff0c\u6211\u53ea\u63a2\u5934\u63d0\u9192\u4e00\u4e0b\u3002',
      interruptLevel: 'low'
    };
  }
  return action;
}

export function applyEvent(state, event) {
  const action = decideAction(state, event);
  const nextState = {
    ...state,
    events: [event, ...state.events].slice(0, 80),
    runtime: {
      ...state.runtime,
      emotion: action.emotion,
      animation: action.animation,
      mode: action.mode || (state.preferences.miniMode ? 'mini' : 'normal'),
      bubble: action.bubble,
      status: action.status,
      lastActionAt: action.createdAt,
      interruptLevel: action.interruptLevel
    }
  };
  return learnFromEvent(nextState, event);
}

export function updatePreference(state, key, value) {
  return {
    ...state,
    preferences: {
      ...state.preferences,
      [key]: value
    },
    runtime: {
      ...state.runtime,
      mode: key === 'miniMode' ? (value ? 'mini' : 'normal') : state.runtime.mode,
      status: key === 'dnd' ? (value ? '\u514d\u6253\u6270\u4e2d' : '\u966a\u4f34\u4e2d') : state.runtime.status
    }
  };
}

export function createTrainingDraft(text, sourceType) {
  const hasRealStyle = /\u771f\u4eba|\u590d\u523b|ex-skill|\u804a\u5929\u8bb0\u5f55|\u5173\u7cfb\u611f/i.test(text);
  return {
    sourceType,
    mode: hasRealStyle ? 'real_person_style_review' : 'original_character',
    persona: hasRealStyle
      ? '\u53c2\u8003\u6750\u6599\u4e2d\u7684\u8bf4\u8bdd\u65b9\u5f0f\u548c\u5173\u7cfb\u6c1b\u56f4\uff0c\u4f46\u4e0d\u81ea\u79f0\u4e3a\u771f\u5b9e\u672c\u4eba\u3002'
      : '\u6839\u636e\u6750\u6599\u8bad\u7ec3\u51fa\u7684\u539f\u521b\u5ba0\u7269\u4eba\u683c\uff0c\u504f\u6e29\u67d4\u966a\u4f34\u548c\u4f4e\u6253\u6270\u3002',
    voiceStyle: text.length > 80 ? '\u77ed\u53e5\u3001\u81ea\u7136\uff0c\u5e26\u4e00\u70b9\u6750\u6599\u91cc\u7684\u8bed\u6c14\u4e60\u60ef\u3002' : '\u77ed\u53e5\u3001\u6e29\u67d4\u3001\u8f7b\u5ea6\u8c03\u76ae\u3002',
    memories: [
      '\u7528\u6237\u5e0c\u671b\u684c\u5ba0\u80fd\u9010\u6e10\u7406\u89e3\u81ea\u5df1\u7684\u504f\u597d\u3002',
      '\u6750\u6599\u4ec5\u4f5c\u4e3a\u504f\u597d\u548c\u6027\u683c\u8bad\u7ec3\u53c2\u8003\u3002'
    ],
    risks: hasRealStyle
      ? ['\u68c0\u6d4b\u5230\u53ef\u80fd\u7684\u771f\u4eba\u98ce\u683c\u590d\u523b\u8bc9\u6c42\uff0c\u9700\u8981\u7528\u6237\u786e\u8ba4\u6750\u6599\u6765\u6e90\u548c\u4f7f\u7528\u8fb9\u754c\u3002']
      : ['\u9ed8\u8ba4\u4e0d\u590d\u523b\u771f\u4eba\uff0c\u53ea\u751f\u6210\u539f\u521b\u5ba0\u7269\u4eba\u683c\u3002']
  };
}
