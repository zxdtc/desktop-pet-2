const MAX_RECENT_INSIGHTS = 24;
const MAX_CANDIDATE_MEMORIES = 24;

const nowIso = () => new Date().toISOString();

const defaultSignals = () => ({
  eventCounts: {},
  lastSeenByType: {},
  totalEvents: 0
});

const defaultRelationship = () => ({
  affinity: 20,
  quietTrust: 40,
  playfulness: 20,
  careNeed: 20,
  updatedAt: null
});

const defaultBehaviorWeights = () => ({
  celebrate: 1,
  care: 1,
  quiet: 1,
  playful: 1
});

export function normalizeMemories(memories = {}) {
  return {
    confirmed: Array.isArray(memories.confirmed) ? memories.confirmed : [],
    candidate: Array.isArray(memories.candidate) ? memories.candidate : [],
    sensitivePending: Array.isArray(memories.sensitivePending) ? memories.sensitivePending : [],
    signals: { ...defaultSignals(), ...(memories.signals || {}) },
    preferences: Array.isArray(memories.preferences) ? memories.preferences : [],
    relationship: { ...defaultRelationship(), ...(memories.relationship || {}) },
    behaviorWeights: { ...defaultBehaviorWeights(), ...(memories.behaviorWeights || {}) },
    recentInsights: Array.isArray(memories.recentInsights) ? memories.recentInsights : []
  };
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function addUnique(list, item, limit = MAX_CANDIDATE_MEMORIES) {
  const text = String(item || '').trim();
  if (!text || list.includes(text)) return list;
  return [text, ...list].slice(0, limit);
}

function upsertPreference(preferences, patch) {
  const id = patch.id;
  const existing = preferences.find((item) => item.id === id);
  const next = existing
    ? {
      ...existing,
      ...patch,
      confidence: clamp((existing.confidence || 0) + (patch.delta || 0), 0, 100),
      evidenceCount: (existing.evidenceCount || 0) + 1,
      lastSeenAt: patch.lastSeenAt || nowIso()
    }
    : {
      id,
      label: patch.label,
      confidence: clamp(patch.confidence || patch.delta || 10, 0, 100),
      evidenceCount: 1,
      lastSeenAt: patch.lastSeenAt || nowIso()
    };
  return [next, ...preferences.filter((item) => item.id !== id)]
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, 12);
}

function insightForEvent(event, count) {
  const seenOften = count >= 3;
  switch (event.type) {
    case 'agent_task_completed':
    case 'pomodoro_completed':
      return {
        preference: {
          id: 'likes_completion_celebration',
          label: '用户适合在任务完成时收到轻度庆祝反馈',
          delta: seenOften ? 12 : 8
        },
        candidate: seenOften ? '用户可能喜欢任务完成后的开心庆祝动作。' : ''
      };
    case 'happy':
    case 'user_returned':
      return {
        preference: {
          id: 'likes_warm_greetings',
          label: '用户回到电脑时适合温和欢迎',
          delta: seenOften ? 10 : 6
        },
        candidate: seenOften ? '用户回到电脑时可以用温和欢迎和开心动作。' : ''
      };
    case 'work_focus_long':
    case 'hydration_reminder':
      return {
        preference: {
          id: 'benefits_from_care_reminders',
          label: '用户长时间工作时适合低打扰照顾提醒',
          delta: seenOften ? 10 : 6
        },
        candidate: seenOften ? '用户长时间工作时适合低打扰喝水或休息提醒。' : ''
      };
    case 'video_attention':
    case 'push_window_preview':
    case 'push_window_executed':
      return {
        preference: {
          id: 'allows_playful_attention',
          label: '用户允许在视频场景中出现调皮求关注',
          delta: seenOften ? 8 : 4
        },
        candidate: seenOften ? '用户可能接受视频场景下的调皮求关注动作。' : ''
      };
    case 'user_away_long':
      return {
        preference: {
          id: 'away_should_be_quiet',
          label: '用户长时间离开时桌宠应安静等待',
          delta: 6
        },
        candidate: seenOften ? '用户长时间离开时桌宠应保持安静陪伴。' : ''
      };
    case 'memo_created':
    case 'memo_due':
      return {
        preference: {
          id: 'uses_memo_assist',
          label: '用户会使用备忘录辅助日常工作',
          delta: seenOften ? 10 : 6
        },
        candidate: seenOften ? '用户会使用备忘录，桌宠可用更明确的到点提醒。' : ''
      };
    default:
      return null;
  }
}

function relationshipDelta(eventType) {
  if (['happy', 'user_returned', 'agent_task_completed', 'pomodoro_completed'].includes(eventType)) {
    return { affinity: 2, playfulness: 1 };
  }
  if (['work_focus_long', 'hydration_reminder', 'memo_due'].includes(eventType)) {
    return { careNeed: 2, quietTrust: 1 };
  }
  if (['video_attention', 'push_window_executed', 'follow-mouse'].includes(eventType)) {
    return { playfulness: 2 };
  }
  if (['user_away_long', 'idle'].includes(eventType)) {
    return { quietTrust: 1 };
  }
  return {};
}

export function learnFromEvent(state, event) {
  if (!event?.type) return state;
  const memories = normalizeMemories(state.memories);
  const at = event.createdAt || nowIso();
  const count = (memories.signals.eventCounts[event.type] || 0) + 1;
  const signals = {
    ...memories.signals,
    totalEvents: (memories.signals.totalEvents || 0) + 1,
    eventCounts: {
      ...memories.signals.eventCounts,
      [event.type]: count
    },
    lastSeenByType: {
      ...memories.signals.lastSeenByType,
      [event.type]: at
    }
  };
  const relationDelta = relationshipDelta(event.type);
  const relationship = {
    ...memories.relationship,
    affinity: clamp((memories.relationship.affinity || 0) + (relationDelta.affinity || 0)),
    quietTrust: clamp((memories.relationship.quietTrust || 0) + (relationDelta.quietTrust || 0)),
    playfulness: clamp((memories.relationship.playfulness || 0) + (relationDelta.playfulness || 0)),
    careNeed: clamp((memories.relationship.careNeed || 0) + (relationDelta.careNeed || 0)),
    updatedAt: at
  };

  let preferences = memories.preferences;
  let candidate = memories.candidate;
  let recentInsights = memories.recentInsights;
  const insight = insightForEvent(event, count);
  if (insight?.preference) {
    preferences = upsertPreference(preferences, { ...insight.preference, lastSeenAt: at });
    recentInsights = [{
      id: `ins_${Date.now()}_${event.type}`,
      type: event.type,
      summary: insight.preference.label,
      createdAt: at,
      evidenceCount: count
    }, ...recentInsights].slice(0, MAX_RECENT_INSIGHTS);
  }
  if (insight?.candidate && !memories.confirmed.includes(insight.candidate)) {
    candidate = addUnique(candidate, insight.candidate);
  }

  return {
    ...state,
    memories: {
      ...memories,
      candidate,
      preferences,
      signals,
      relationship,
      recentInsights
    }
  };
}

export function buildMemoryContext(memories = {}) {
  const normalized = normalizeMemories(memories);
  return {
    confirmed: normalized.confirmed.slice(0, 8),
    topPreferences: normalized.preferences.slice(0, 6).map((item) => ({
      label: item.label,
      confidence: item.confidence,
      evidenceCount: item.evidenceCount
    })),
    relationship: normalized.relationship,
    recentInsights: normalized.recentInsights.slice(0, 6).map((item) => ({
      type: item.type,
      summary: item.summary,
      evidenceCount: item.evidenceCount
    }))
  };
}
