export function sanitizeSpriteActionId(value) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
}

const knownActionIds = new Map([
  ['待机', 'idle'],
  ['待命', 'idle'],
  ['呼吸', 'idle'],
  ['开心', 'happy'],
  ['高兴', 'happy'],
  ['快乐', 'happy'],
  ['难过', 'sad'],
  ['伤心', 'sad'],
  ['悲伤', 'sad'],
  ['走路', 'walk'],
  ['向右走', 'walk-right'],
  ['右走', 'walk-right'],
  ['向左走', 'walk-left'],
  ['左走', 'walk-left'],
  ['生气', 'angry'],
  ['惊讶', 'surprised'],
  ['睡觉', 'sleep'],
  ['思考', 'thinking'],
  ['工作', 'working'],
  ['提醒', 'remind']
]);

const defaultAvoidItems = 'text, labels, frame numbers, borders, UI, speech bubbles, thought bubbles, floating symbols, detached effects, props, shadows, floor, scenery, background';
const bodyPosturePhrase = 'Use body posture and facial expression only, not detached effects.';
const defaultFrameCount = 12;
const defaultChromaKey = '#00FF00';

export function normalizeSpriteActionId(value, index = 0) {
  const raw = String(value || '').trim();
  if (knownActionIds.has(raw)) return knownActionIds.get(raw);
  const ascii = raw
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return ascii || `action-${index + 1}`;
}

export function normalizeStructuredSpriteActions(rawValue, defaults = {}) {
  const source = rawValue && typeof rawValue === 'object' ? rawValue : {};
  const rawActions = Array.isArray(source) ? source : source.actions;
  const errors = [];
  if (!Array.isArray(rawActions) || rawActions.length < 1) {
    return {
      ok: false,
      data: null,
      errors: ['至少需要配置 1 个动作。']
    };
  }

  const actions = rawActions.map((action, index) => {
    const actionSource = action && typeof action === 'object' ? action : {};
    const id = normalizeSpriteActionId(actionSource.id || actionSource.name || actionSource.action || actionSource.label, index);
    const frameCount = Number.isInteger(Number(actionSource.frame_count)) && Number(actionSource.frame_count) > 0
      ? Number(actionSource.frame_count)
      : defaultFrameCount;
    const rawDescription = String(actionSource.description || actionSource.requirement || actionSource.prompt || '').trim();
    const description = rawDescription.includes(bodyPosturePhrase)
      ? rawDescription
      : `${rawDescription || id} ${bodyPosturePhrase}`.trim();
    const avoid = [String(actionSource.avoid || '').trim(), defaultAvoidItems]
      .filter(Boolean)
      .join(', ');
    return {
      id,
      frame_count: Math.max(1, Math.min(24, frameCount)),
      description,
      avoid
    };
  });

  const structured = {
    pet_name: String(source.pet_name || source.petName || defaults.petName || '').trim(),
    style_notes: String(source.style_notes || source.styleNotes || defaults.styleNotes || '').trim(),
    chroma_key: ['#0000FF', '#00FF00'].includes(String(source.chroma_key || source.chromaKey || defaults.chromaKey || defaultChromaKey).trim().toUpperCase())
      ? String(source.chroma_key || source.chromaKey || defaults.chromaKey || defaultChromaKey).trim().toUpperCase()
      : defaultChromaKey,
    actions
  };

  const validation = parseAndValidateSpriteActions(JSON.stringify(actions));
  if (!validation.ok) errors.push(...validation.errors);
  return {
    ok: errors.length === 0,
    data: errors.length === 0 ? structured : null,
    errors
  };
}

export function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('模型没有返回内容。');
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1]);
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error('模型返回内容不是有效 JSON。');
  }
}

export function createSpriteActionStructureMessages(config = {}) {
  const payload = {
    pet_name: String(config.petName || '').trim(),
    style_notes: String(config.styleNotes || '').trim(),
    chroma_key: String(config.chromaKey || defaultChromaKey).trim() || defaultChromaKey,
    natural_language: String(config.naturalLanguage || '').trim()
  };
  return [
    {
      role: 'system',
      content: [
        'Return only strict JSON with this shape: {"pet_name":"","style_notes":"","chroma_key":"#00FF00","actions":[{"id":"idle","frame_count":12,"description":"","avoid":""}]}.',
        'Convert user desktop-pet action requirements into actions.',
        'Use lowercase English ids with letters, numbers, hyphen, or underscore only. Translate common Chinese action names, for example 开心 -> happy, 难过 -> sad, 待机 -> idle.',
        'Use frame_count 12 for every action by default. Only use another count if the user explicitly edits the JSON later.',
        'Every description must describe a coherent 12-frame motion using body posture and facial expression, not detached effects.',
        'Every avoid field must include bans for text, symbols, props, detached effects, UI, shadows, floor, and scenery.',
        'Use chroma_key #00FF00 for pure green background unless the existing input explicitly provides another supported chroma key.'
      ].join(' ')
    },
    {
      role: 'user',
      content: JSON.stringify(payload)
    }
  ];
}

export function parseAndValidateSpriteActions(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, actions: [], errors: [`动作 JSON 格式错误：${error.message}`] };
  }
  const rawActions = Array.isArray(parsed) ? parsed : parsed?.actions;
  if (!Array.isArray(rawActions)) {
    return { ok: false, actions: [], errors: ['动作 JSON 必须是数组，或包含 actions 数组。'] };
  }
  if (rawActions.length < 1) {
    return { ok: false, actions: [], errors: ['至少需要配置 1 个动作。'] };
  }

  const errors = [];
  const seen = new Set();
  const actions = rawActions.map((action, index) => {
    const id = sanitizeSpriteActionId(action?.id);
    const frameCount = Number(action?.frame_count);
    const description = String(action?.description || '').trim();
    const avoid = String(action?.avoid || '').trim();
    const label = id || `第 ${index + 1} 个动作`;
    if (!id) errors.push(`${label}：id 不能为空，只能使用字母、数字、下划线或短横线。`);
    if (id && seen.has(id)) errors.push(`${label}：动作 id 重复。`);
    if (id) seen.add(id);
    if (!Number.isInteger(frameCount) || frameCount < 1) errors.push(`${label}：frame_count 必须是正整数。`);
    if (!description) errors.push(`${label}：description 不能为空。`);
    return {
      id,
      frame_count: frameCount,
      description,
      avoid
    };
  });

  return {
    ok: errors.length === 0,
    actions,
    errors
  };
}
