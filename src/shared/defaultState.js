import { defaultDeepSeekEndpoint, defaultDeepSeekModel } from './deepSeekClient.js';

const zh = {
  petName: '\u5c0f\u56e2\u5b50',
  persona: '\u6e29\u67d4\u3001\u8f7b\u5ea6\u8c03\u76ae\u3001\u4f4e\u6253\u6270\u7684\u5de5\u4f5c\u966a\u4f34\u684c\u5ba0\u3002',
  voice: '\u77ed\u53e5\u3001\u81ea\u7136\u3001\u4e0d\u8bf4\u6559\uff0c\u5076\u5c14\u53ef\u7231\u5410\u69fd\u3002',
  relation: '\u539f\u521b\u5ba0\u7269\u4eba\u683c\uff0c\u966a\u4f34\u7528\u6237\u5de5\u4f5c\u548c\u4f11\u606f\u3002',
  lowInterrupt: '\u7528\u6237\u5e0c\u671b\u684c\u5ba0\u9ed8\u8ba4\u4f4e\u6253\u6270\u3002',
  completedCelebrate: '\u7528\u6237\u53ef\u80fd\u559c\u6b22\u4efb\u52a1\u5b8c\u6210\u540e\u7684\u8f7b\u5fae\u5e86\u795d\u3002',
  readyBubble: '\u6211\u51c6\u5907\u597d\u4e86\uff0c\u4eca\u5929\u4e5f\u966a\u4f60\u5de5\u4f5c\u3002',
  companion: '\u966a\u4f34\u4e2d',
  defaultOn: '\u4f7f\u7528\u9ed8\u8ba4',
  optionalOff: '\u53ef\u9009\u672a\u914d\u7f6e',
  requiredHint: '\u5efa\u8bae 6-8 \u5e27\u900f\u660e WebP/GIF',
  optionalHint: '\u53ef\u9009 6-12 \u5e27\u900f\u660e WebP/GIF'
};

export const defaultAssetSlots = [
  ['idle', '\u5f85\u673a', '\u57fa\u7840\u72b6\u6001', true, '\u5e73\u65f6\u5b89\u9759\u966a\u4f34', ['ambient']],
  ['happy', '\u5f00\u5fc3', '\u60c5\u7eea\u53cd\u9988', true, '\u7528\u6237\u56de\u6765\u3001\u70b9\u51fb\u5ba0\u7269\u3001\u8f7b\u5ea6\u5e86\u795d', ['happy']],
  ['sad', '\u59d4\u5c48', '\u60c5\u7eea\u53cd\u9988', true, '\u957f\u65f6\u95f4\u6ca1\u6709\u4e92\u52a8\u3001\u8f7b\u5ea6\u5931\u843d', ['sad']],
  ['sleep', '\u7761\u89c9', '\u57fa\u7840\u72b6\u6001', true, '\u957f\u65f6\u95f4\u79bb\u5f00\u3001\u591c\u95f4\u5b89\u9759', ['sleepy']],
  ['working', '\u5de5\u4f5c\u4e2d', '\u5de5\u4f5c\u4e8b\u4ef6', true, '\u7528\u6237\u4e13\u6ce8\u6216 Agent \u6267\u884c\u4e2d', ['focused']],
  ['waiting', '\u7b49\u5f85', '\u5de5\u4f5c\u4e8b\u4ef6', true, '\u7b49\u5f85\u7528\u6237\u8f93\u5165\u6216\u6743\u9650', ['waiting']],
  ['failed', '\u5931\u8d25', '\u5de5\u4f5c\u4e8b\u4ef6', true, '\u4efb\u52a1\u5931\u8d25\u6216\u62a5\u9519', ['worried']],
  ['remind', '\u63d0\u9192', '\u7279\u6b8a\u63d0\u9192', true, '\u559d\u6c34\u3001\u4f11\u606f\u3001\u5907\u5fd8\u5f55\u63d0\u9192', ['care']],
  ['peek-left', '\u5de6\u4fa7\u63a2\u5934', '迷你模式', true, '\u5de6\u4fa7\u8d34\u8fb9\u9732\u51fa', ['ambient']],
  ['peek-right', '\u53f3\u4fa7\u63a2\u5934', '迷你模式', true, '\u53f3\u4fa7\u8d34\u8fb9\u9732\u51fa', ['ambient']],
  ['pop-out', '\u63a2\u51fa\u6765', '迷你模式', true, '\u91cd\u8981\u4e8b\u4ef6\u4ece\u8fb9\u7f18\u51fa\u73b0', ['attention']],
  ['attention', '\u6c42\u5173\u6ce8', '\u8c03\u76ae\u4e92\u52a8', true, '\u957f\u65f6\u95f4\u6ca1\u6709\u4e92\u52a8\u540e\u7684\u6492\u5a07\u63d0\u9192', ['clingy']],
  ['celebrate', '\u5f00\u5fc3\u5e86\u795d', '\u60c5\u7eea\u53cd\u9988', true, '\u4efb\u52a1\u5b8c\u6210\u3001\u756a\u8304\u949f\u5b8c\u6210', ['happy', 'proud']],
  ['push-window', '\u63a8\u7a97\u53e3', '\u8c03\u76ae\u4e92\u52a8', false, '\u770b\u89c6\u9891\u592a\u4e45\u4e14\u957f\u65f6\u95f4\u6ca1\u4e92\u52a8', ['mischief']],
  ['drag-note', '\u62d6\u7eb8\u6761', '\u8c03\u76ae\u4e92\u52a8', false, '\u62d6\u51fa\u63d0\u9192\u5361\u6216\u4eca\u65e5\u5c0f\u7ed3', ['playful']],
  ['follow-mouse', '\u8ffd\u9f20\u6807', '\u8c03\u76ae\u4e92\u52a8', false, '\u7528\u6237\u5141\u8bb8\u8c03\u76ae\u4e92\u52a8\u65f6\u77ed\u6682\u8ddf\u968f', ['playful']],
  ['rainy', '\u4e0b\u96e8', '\u5929\u6c14\u65f6\u95f4', false, '\u5f53\u5730\u5929\u6c14\u4e0b\u96e8', ['soft']],
  ['hot', '\u9ad8\u6e29', '\u5929\u6c14\u65f6\u95f4', false, '\u5929\u6c14\u708e\u70ed\u65f6\u63d0\u9192\u559d\u6c34', ['care']],
  ['cold', '\u4f4e\u6e29', '\u5929\u6c14\u65f6\u95f4', false, '\u5929\u6c14\u5bd2\u51b7\u65f6\u966a\u4f34', ['care']],
  ['night', '\u591c\u665a', '\u5929\u6c14\u65f6\u95f4', false, '\u591c\u95f4\u5de5\u4f5c\u6216\u665a\u5b89', ['quiet']],
  ['focus-working', '\u4e13\u6ce8\u4e2d', '\u756a\u8304\u949f', false, '\u756a\u8304\u949f\u4e13\u6ce8\u9636\u6bb5', ['focused']],
  ['focus-complete', '\u4e13\u6ce8\u5b8c\u6210', '\u756a\u8304\u949f', false, '\u756a\u8304\u949f\u5b8c\u6210\u5e86\u795d', ['proud']],
  ['memo-write', '\u8bb0\u7b14\u8bb0', '\u5907\u5fd8\u5f55', false, '\u65b0\u5efa\u5907\u5fd8\u5f55', ['helpful']],
  ['memo-remind', '\u5907\u5fd8\u63d0\u9192', '\u5907\u5fd8\u5f55', false, '\u5907\u5fd8\u5f55\u5230\u70b9\u63d0\u9192', ['care']]
].map(([id, name, category, required, trigger, tags]) => ({
  id,
  name,
  category,
  required,
  trigger,
  tags,
  status: required ? zh.defaultOn : zh.optionalOff,
  fallback: id === 'celebrate' ? 'happy' : 'idle',
  frameHint: required ? zh.requiredHint : zh.optionalHint,
  assetPath: null,
  assetUrl: null,
  updatedAt: null,
  validation: null
}));

export const createDefaultState = () => ({
  character: {
    id: 'xiaotuanzi',
    displayName: zh.petName,
    type: 'original',
    persona: zh.persona,
    voiceStyle: zh.voice,
    relationshipStyle: zh.relation
  },
  memories: {
    confirmed: [zh.lowInterrupt],
    candidate: [zh.completedCelebrate],
    sensitivePending: [],
    signals: {
      eventCounts: {},
      lastSeenByType: {},
      totalEvents: 0
    },
    preferences: [
      {
        id: 'low_interrupt_default',
        label: zh.lowInterrupt,
        confidence: 70,
        evidenceCount: 1,
        lastSeenAt: new Date().toISOString()
      }
    ],
    relationship: {
      affinity: 20,
      quietTrust: 40,
      playfulness: 20,
      careNeed: 20,
      updatedAt: null
    },
    behaviorWeights: {
      celebrate: 1,
      care: 1,
      quiet: 1,
      playful: 1
    },
    recentInsights: []
  },
  preferences: {
    miniMode: false,
    dnd: false,
    playfulEnabled: true,
    pushWindowEnabled: false,
    pushWindowDailyLimit: 2,
    pushWindowPreviewSeconds: 2,
    interactionLevel: 2,
    dailyReminderLimit: 8,
    quietHours: true,
    proactiveEnabled: true,
    aiProactiveDecision: true,
    workFocusReminderMinutes: 50,
    hydrationReminderMinutes: 90,
    awayLongSeconds: 900,
    returnGreetingIdleSeconds: 180,
    videoAttentionIdleSeconds: 1200,
    proactiveCooldownMinutes: 45,
    deepSeekKeyConfigured: false,
    miniEdge: 'right',
    openPanelOnStart: true
  },
  pushWindowGuard: {
    date: new Date().toISOString().slice(0, 10),
    usedToday: 0,
    lastPreviewAt: null,
    lastExecutedAt: null,
    lastBlockedReason: ''
  },
  deepSeek: {
    enabled: false,
    apiKey: '',
    model: defaultDeepSeekModel,
    endpoint: defaultDeepSeekEndpoint,
    lastTest: null,
    decisionLogs: []
  },
  agentBridge: {
    enabled: true,
    host: '127.0.0.1',
    port: 28777,
    endpoint: 'http://127.0.0.1:28777/agent-event',
    status: '\u672a\u542f\u52a8'
  },
  systemStatus: {
    idleSeconds: 0,
    memoryMb: 0,
    processMemoryMb: 0,
    battery: '\u672a\u77e5',
    lastUpdatedAt: null,
    foregroundCategory: '\u672a\u68c0\u6d4b',
    foregroundProcess: '',
    foregroundTitleSafe: ''
  },
  weather: {
    status: '\u672a\u5237\u65b0',
    location: '',
    temperature: '',
    summary: '',
    lastUpdatedAt: null
  },
  runtime: {
    emotion: 'happy',
    animation: 'idle',
    mode: 'normal',
    bubble: zh.readyBubble,
    status: zh.companion,
    pausedUntil: null,
    lastActionAt: null,
    interruptLevel: 'ambient'
  },
  pomodoro: {
    status: 'idle',
    focusMinutes: 25,
    breakMinutes: 5,
    startedAt: null,
    remainingSeconds: 25 * 60,
    completedToday: 0
  },
  memos: [
    {
      id: 'memo_sample',
      text: '\u8bd5\u8bd5\u8ba9\u684c\u5ba0\u63d0\u9192\u6211\u770b Codex \u4efb\u52a1\u3002',
      type: 'normal',
      status: 'pending',
      dueAt: null,
      createdAt: new Date().toISOString()
    }
  ],
  characterVersions: [],
  hookScripts: {
    status: '\u672a\u751f\u6210',
    codexPath: '',
    claudePath: '',
    endpoint: '',
    installStatus: '\u672a\u5b89\u88c5',
    configCandidates: [],
    snippetDir: '',
    snippets: [],
    installedTargets: []
  },
  packageValidation: {
    status: '\u672a\u6821\u9a8c',
    issues: [],
    warnings: [],
    checkedAt: null
  },
  petSpriteGenerator: {
    referencePath: '',
    currentRunDir: '',
    status: '\u672a\u521b\u5efa',
    lastGenerationStatusPath: '',
    lastValidationPath: '',
    lastContactSheetPath: '',
    lastSpritesheetPath: '',
    generationJobs: [],
    validationSummary: null,
    previewMedia: null,
    autoGeneration: null,
    appliedSprite: null,
    recentRuns: []
  },
  events: [
    {
      id: 'evt_boot',
      type: 'app_started',
      source: 'local',
      summary: '\u684c\u5ba0 2.0 \u5df2\u542f\u52a8\uff0c\u4f7f\u7528\u672c\u5730\u5b89\u5168\u6458\u8981\u8fd0\u884c\u3002',
      privacyLevel: 'safe_summary',
      rawDataStored: false,
      createdAt: new Date().toISOString()
    }
  ],
  assetSlots: defaultAssetSlots,
  trainingDraft: null,
  privacy: {
    foregroundCategory: true,
    windowTitleClassification: false,
    agentHooks: true,
    weather: true,
    keyboardContent: false,
    screenshot: false
  }
});
