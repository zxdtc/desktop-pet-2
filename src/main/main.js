import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, dialog, powerMonitor, shell } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { createDefaultState } from '../shared/defaultState.js';
import { applyEvent, buildEvent, createTrainingDraft, updatePreference } from '../shared/behaviorEngine.js';
import { createDeepSeekRequestBody, defaultDeepSeekEndpoint, defaultDeepSeekModel } from '../shared/deepSeekClient.js';
import { buildAppliedPetSprite, readPetSpriteManifest, readPetSpriteRunSummary } from '../shared/petSpriteApply.js';
import { createSpriteActionStructureMessages, extractJsonObject, normalizeStructuredSpriteActions } from '../shared/petSpriteActions.js';
import { readPetSpritePreviewMedia, readPetSpriteValidationSummary } from '../shared/petSpriteState.js';
import { buildMemoryContext, learnFromEvent, normalizeMemories } from '../shared/memoryEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const supportedAssetExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

let panelWindow;
let petWindow;
let tray;
let state = createDefaultState();
let dragOrigin = null;
let pomodoroTimer = null;
let memoTimer = null;
let systemTimer = null;
let weatherTimer = null;
let agentServer = null;
let followMouseTimer = null;
let proactiveBusy = false;
const proactiveState = {
  activeWorkStartedAt: null,
  lastFocusReminderAt: 0,
  lastHydrationAt: 0,
  lastVideoAttentionAt: 0,
  lastAwayEventAt: 0,
  lastReturnEventAt: 0,
  wasAway: false
};
let lastWeatherEventKey = '';

const statePath = () => path.join(app.getPath('userData'), 'desktop-pet-state.json');

function looksGarbled(value) {
  if (typeof value !== 'string') return false;
  return Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return code === 0xfffd || (code >= 0x9500 && code <= 0x9fff);
  });
}

function mergeState(defaults, stored = {}) {
  const merged = { ...defaults, ...stored };
  merged.preferences = { ...defaults.preferences, ...(stored.preferences || {}) };
  merged.runtime = { ...defaults.runtime, ...(stored.runtime || {}) };
  merged.memories = normalizeMemories({ ...defaults.memories, ...(stored.memories || {}) });
  merged.privacy = { ...defaults.privacy, ...(stored.privacy || {}) };
  merged.deepSeek = { ...defaults.deepSeek, ...(stored.deepSeek || {}) };
  merged.deepSeek.decisionLogs = stored.deepSeek?.decisionLogs || defaults.deepSeek.decisionLogs;
  if (!stored.deepSeek?.model || stored.deepSeek.model === 'deepseek-chat') {
    merged.deepSeek.model = defaultDeepSeekModel;
  }
  if (!merged.deepSeek.apiKey && process.env.DEEPSEEK_API_KEY) {
    merged.deepSeek.apiKey = process.env.DEEPSEEK_API_KEY;
    merged.deepSeek.enabled = true;
    merged.preferences.deepSeekKeyConfigured = true;
  }
  merged.agentBridge = { ...defaults.agentBridge, ...(stored.agentBridge || {}) };
  merged.systemStatus = { ...defaults.systemStatus, ...(stored.systemStatus || {}) };
  merged.weather = { ...defaults.weather, ...(stored.weather || {}) };
  merged.hookScripts = { ...defaults.hookScripts, ...(stored.hookScripts || {}) };
  merged.packageValidation = { ...defaults.packageValidation, ...(stored.packageValidation || {}) };
  merged.petSpriteGenerator = { ...defaults.petSpriteGenerator, ...(stored.petSpriteGenerator || {}) };
  merged.pushWindowGuard = { ...defaults.pushWindowGuard, ...(stored.pushWindowGuard || {}) };
  merged.characterVersions = stored.characterVersions || defaults.characterVersions;

  const storedSlots = new Map((stored.assetSlots || []).map((slot) => [slot.id, slot]));
  merged.assetSlots = defaults.assetSlots.map((slot) => {
    const storedSlot = storedSlots.get(slot.id) || {};
    const mergedSlot = { ...slot, ...storedSlot };
    if (looksGarbled(mergedSlot.name) || looksGarbled(mergedSlot.category) || looksGarbled(mergedSlot.status)) {
      return {
        ...slot,
        assetPath: storedSlot.assetPath || null,
        assetUrl: storedSlot.assetUrl || null,
        updatedAt: storedSlot.updatedAt || null,
        validation: storedSlot.validation || null,
        status: storedSlot.assetUrl ? '已配置' : slot.status
      };
    }
    return mergedSlot;
  });

  if (looksGarbled(merged.character.displayName) || looksGarbled(merged.character.persona)) {
    merged.character = defaults.character;
    merged.memories = defaults.memories;
    merged.runtime = defaults.runtime;
  }
  return merged;
}

function loadState() {
  try {
    if (fs.existsSync(statePath())) {
      const stored = JSON.parse(fs.readFileSync(statePath(), 'utf8'));
      state = mergeState(createDefaultState(), stored);
    }
  } catch {
    state = createDefaultState();
  }
}

function saveState() {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(statePath(), JSON.stringify(state, null, 2), 'utf8');
}

function broadcastState() {
  panelWindow?.webContents.send('state:changed', state);
  petWindow?.webContents.send('state:changed', state);
  saveState();
  updateTray();
}

function pageUrl(page) {
  if (isDev) return `${process.env.VITE_DEV_SERVER_URL}${page === 'pet' ? 'pet.html' : 'index.html'}`;
  return pathToFileURL(path.join(__dirname, '../../dist', page === 'pet' ? 'pet.html' : 'index.html')).toString();
}

function createPanelWindow() {
  panelWindow = new BrowserWindow({
    width: 1180,
    height: 790,
    minWidth: 980,
    minHeight: 650,
    title: '桌宠 2.0 控制面板',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, '../preload/panelPreload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  panelWindow.loadURL(pageUrl('panel'));
  panelWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      panelWindow.hide();
    }
  });
}

function createPetWindow() {
  const display = screen.getPrimaryDisplay().workArea;
  petWindow = new BrowserWindow({
    width: 260,
    height: 310,
    x: display.x + display.width - 310,
    y: display.y + display.height - 360,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/petPreload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  petWindow.setAlwaysOnTop(true, 'floating');
  petWindow.loadURL(pageUrl('pet'));
}

function applyPetWindowMode() {
  if (!petWindow) return;
  const display = screen.getPrimaryDisplay().workArea;
  if (state.preferences.miniMode) {
    const width = 180;
    const height = 240;
    const edge = state.preferences.miniEdge || 'right';
    const x = edge === 'left' ? display.x - 92 : display.x + display.width - 88;
    const y = display.y + display.height - height - 18;
    petWindow.setBounds({ x, y, width, height }, true);
    return;
  }
  const current = petWindow.getBounds();
  const width = 260;
  const height = 310;
  const x = Math.max(display.x, Math.min(current.x, display.x + display.width - width));
  const y = Math.max(display.y, Math.min(current.y, display.y + display.height - height));
  petWindow.setBounds({ x, y, width, height }, true);
}

function makeTrayIcon(color = '#45b3ff') {
  const svg = `<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="8" fill="${color}"/><circle cx="11" cy="14" r="3" fill="white"/><circle cx="21" cy="14" r="3" fill="white"/><path d="M11 22c3 3 7 3 10 0" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

function updateTray() {
  if (!tray) return;
  const color = state.preferences.dnd ? '#64748b' : state.preferences.miniMode ? '#f59e0b' : '#45b3ff';
  tray.setImage(makeTrayIcon(color));
  tray.setToolTip(`桌宠 2.0 - ${state.runtime.status}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: petWindow?.isVisible() ? '隐藏桌宠' : '显示桌宠', click: () => togglePet() },
    { label: '打开控制面板', click: () => showPanel() },
    { type: 'separator' },
    { label: `状态：${state.runtime.status}`, enabled: false },
    { label: `角色：${state.character.displayName}`, enabled: false },
    { label: `智能体：${state.agentBridge.status}`, enabled: false },
    { type: 'separator' },
    { label: '迷你模式', type: 'checkbox', checked: state.preferences.miniMode, click: (item) => setPreference('miniMode', item.checked) },
    { label: '免打扰', type: 'checkbox', checked: state.preferences.dnd, click: (item) => setPreference('dnd', item.checked) },
    { label: '暂停主动互动 1 小时', click: () => pauseInteractions() },
    { label: '开始番茄钟', click: () => startPomodoroSession() },
    { type: 'separator' },
    { label: '模拟智能体完成', click: () => triggerEvent('agent_task_completed') },
    { label: '模拟等待权限', click: () => triggerEvent('agent_permission_waiting') },
    { label: '重启事件桥接', click: () => restartAgentServer() },
    { type: 'separator' },
    { label: '退出', click: () => quitApp() }
  ]));
}

function createTray() {
  tray = new Tray(makeTrayIcon());
  tray.on('double-click', () => showPanel());
  updateTray();
}

function showPanel() {
  if (!panelWindow) createPanelWindow();
  panelWindow.show();
  panelWindow.focus();
}

function togglePet() {
  if (!petWindow) return;
  if (petWindow.isVisible()) petWindow.hide();
  else petWindow.show();
  updateTray();
}

function setPreference(key, value) {
  state = updatePreference(state, key, value);
  if (key === 'miniMode' || key === 'miniEdge') applyPetWindowMode();
  broadcastState();
  return state;
}

const eventLabels = {
  agent_task_completed: '智能体任务已完成。',
  agent_permission_waiting: '智能体正在等待权限。',
  agent_error: '智能体报告了错误。',
  work_focus_long: '用户已经专注工作较长时间。',
  rainy_weather: '下雨天气陪伴事件。',
  video_attention: '用户长时间看视频且没有和桌宠互动。',
  pomodoro_completed: '番茄钟专注已完成。',
  memo_due: '有备忘录到点提醒。',
  app_started: '行为引擎已启动。'
};

function addEvent(type, summary, source = 'local') {
  const event = buildEvent(type, summary, source);
  state = {
    ...state,
    events: [event, ...state.events].slice(0, 80)
  };
  state = learnFromEvent(state, event);
}

function addDeepSeekLog(summary, ok = true, payload = null) {
  state = {
    ...state,
    deepSeek: {
      ...state.deepSeek,
      decisionLogs: [
        { createdAt: new Date().toISOString(), summary, ok, payload },
        ...(state.deepSeek.decisionLogs || [])
      ].slice(0, 30)
    }
  };
}

function deepSeekRequestBody(messages, extra = {}) {
  return createDeepSeekRequestBody({
    model: state.deepSeek.model || defaultDeepSeekModel,
    messages,
    extra
  });
}

function snapshotCharacter(reason) {
  state = {
    ...state,
    characterVersions: [{
      createdAt: new Date().toISOString(),
      reason,
      character: state.character,
      memories: state.memories
    }, ...state.characterVersions].slice(0, 20)
  };
}

function updateCharacter(patch = {}) {
  const allowed = ['displayName', 'persona', 'voiceStyle', 'relationshipStyle'];
  const nextPatch = {};
  for (const key of allowed) {
    if (typeof patch[key] === 'string') nextPatch[key] = patch[key].trim().slice(0, key === 'displayName' ? 32 : 600);
  }
  if (!Object.keys(nextPatch).length) return state;
  snapshotCharacter('before_manual_character_edit');
  state = {
    ...state,
    character: {
      ...state.character,
      ...nextPatch,
      type: state.character.type || 'original'
    }
  };
  addEvent('character_updated', '角色资料已从控制面板更新。');
  broadcastState();
  return state;
}

function setPomodoroConfig(config = {}) {
  const focusMinutes = Math.max(1, Math.min(180, Number(config.focusMinutes || state.pomodoro.focusMinutes)));
  const breakMinutes = Math.max(1, Math.min(60, Number(config.breakMinutes || state.pomodoro.breakMinutes)));
  state = {
    ...state,
    pomodoro: {
      ...state.pomodoro,
      focusMinutes,
      breakMinutes,
      remainingSeconds: state.pomodoro.status === 'idle' ? focusMinutes * 60 : state.pomodoro.remainingSeconds
    }
  };
  addEvent('pomodoro_config_updated', `番茄钟配置已更新：专注 ${focusMinutes} 分钟 / 休息 ${breakMinutes} 分钟。`);
  broadcastState();
  return state;
}

function setPrivacyPreference(key, value) {
  if (!Object.prototype.hasOwnProperty.call(state.privacy, key)) return state;
  state = {
    ...state,
    privacy: {
      ...state.privacy,
      [key]: Boolean(value)
    }
  };
  addEvent('privacy_preference_updated', `隐私偏好已更新：${key}`);
  broadcastState();
  return state;
}

function sanitizeAiAction(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return { ok: false, reason: '模型决策不是对象。' };
  }
  const action = {
    bubble: typeof candidate.bubble === 'string' ? candidate.bubble.slice(0, 80) : '',
    status: typeof candidate.status === 'string' ? candidate.status.slice(0, 30) : '',
    emotion: typeof candidate.emotion === 'string' ? candidate.emotion.slice(0, 20) : ''
  };
  if (!action.bubble && !action.status && !action.emotion) {
    return { ok: false, reason: '模型决策没有可用字段。' };
  }
  return { ok: true, action };
}

async function askDeepSeekForAction(event) {
  if (!state.deepSeek.enabled || !state.deepSeek.apiKey) return null;
  const safeSummary = {
    eventType: event.type,
    summary: event.summary,
    pet: state.character.persona,
    memory: buildMemoryContext(state.memories),
    preferences: {
      dnd: state.preferences.dnd,
      miniMode: state.preferences.miniMode,
      interactionLevel: state.preferences.interactionLevel
    },
    system: {
      idleSeconds: state.systemStatus.idleSeconds,
      foregroundCategory: state.systemStatus.foregroundCategory,
      memoryMb: state.systemStatus.memoryMb,
      processMemoryMb: state.systemStatus.processMemoryMb,
      battery: state.systemStatus.battery
    },
    weather: state.weather
  };

  try {
    const response = await fetch(state.deepSeek.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.deepSeek.apiKey}`
      },
      body: JSON.stringify(deepSeekRequestBody([
          {
            role: 'system',
            content: 'Return only JSON: {"bubble":"short text","status":"short status","emotion":"short emotion"}. No private data.'
          },
          { role: 'user', content: JSON.stringify(safeSummary) }
        ]))
    });
    if (!response.ok) {
      addDeepSeekLog(`请求失败 HTTP ${response.status}：${event.type}`, false, safeSummary);
      return null;
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '';
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }
    const validation = sanitizeAiAction(parsed);
    if (!validation.ok) {
      addDeepSeekLog(`无效决策：${validation.reason}`, false, safeSummary);
      return null;
    }
    addDeepSeekLog(`已接受 ${event.type} 的模型决策：${validation.action.status || '无状态'}`, true, safeSummary);
    return validation.action;
  } catch (error) {
    addDeepSeekLog(`调用失败：${error.message}`, false, safeSummary);
    return null;
  }
}

function validateProactiveDecision(candidate, fallbackType) {
  const allowedTypes = new Set([
    'work_focus_long',
    'hydration_reminder',
    'user_away_long',
    'user_returned',
    'video_attention',
    'idle'
  ]);
  if (!candidate || typeof candidate !== 'object') {
    return { allow: true, eventType: fallbackType, reason: '无效决策，使用本地兜底' };
  }
  const allow = typeof candidate.allow === 'boolean' ? candidate.allow : true;
  const eventType = allowedTypes.has(candidate.eventType) ? candidate.eventType : fallbackType;
  const reason = typeof candidate.reason === 'string' ? candidate.reason.slice(0, 120) : '';
  return { allow, eventType, reason };
}

async function askDeepSeekForProactiveDecision(candidateType, context) {
  if (!state.preferences.aiProactiveDecision || !state.deepSeek.enabled || !state.deepSeek.apiKey) {
    return { allow: true, eventType: candidateType, reason: '本地兜底' };
  }
  const safeSummary = {
    candidateType,
    context,
      pet: {
        persona: state.character.persona,
        voiceStyle: state.character.voiceStyle,
        memory: buildMemoryContext(state.memories)
      },
    preferences: {
      dnd: state.preferences.dnd,
      miniMode: state.preferences.miniMode,
      interactionLevel: state.preferences.interactionLevel,
      proactiveCooldownMinutes: state.preferences.proactiveCooldownMinutes
    },
    recentEvents: state.events.slice(0, 8).map((event) => ({
      type: event.type,
      createdAt: event.createdAt
    }))
  };
  try {
    const response = await fetch(state.deepSeek.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.deepSeek.apiKey}`
      },
      body: JSON.stringify(deepSeekRequestBody([
          {
            role: 'system',
            content: 'Return only JSON: {"allow":true,"eventType":"work_focus_long","reason":"short reason"}. Choose eventType from work_focus_long, hydration_reminder, user_away_long, user_returned, video_attention, idle. Suppress low-value interruptions.'
          },
          { role: 'user', content: JSON.stringify(safeSummary) }
        ]))
    });
    if (!response.ok) {
      addDeepSeekLog(`主动决策请求失败 HTTP ${response.status}：${candidateType}`, false, safeSummary);
      return { allow: true, eventType: candidateType, reason: '模型请求失败，使用本地兜底' };
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(content);
    const decision = validateProactiveDecision(parsed, candidateType);
    addDeepSeekLog(`主动决策${decision.allow ? '允许' : '抑制'}：${candidateType} -> ${decision.eventType}`, true, {
      ...safeSummary,
      decision
    });
    return decision;
  } catch (error) {
    addDeepSeekLog(`主动决策失败：${error.message}`, false, safeSummary);
    return { allow: true, eventType: candidateType, reason: '模型错误，使用本地兜底' };
  }
}

async function triggerProactiveCandidate(candidateType, context) {
  const decision = await askDeepSeekForProactiveDecision(candidateType, context);
  if (!decision.allow) {
    addEvent('proactive_event_suppressed', `已抑制 ${candidateType}：${decision.reason || '无原因'}`);
    return state;
  }
  return triggerEvent(decision.eventType || candidateType);
}

async function triggerEvent(type) {
  const event = buildEvent(type, eventLabels[type] || '新的安全摘要事件。');
  state = applyEvent(state, event);
  if (type === 'follow-mouse') startFollowMouseInteraction();
  if (type === 'video_attention') {
    state = applyEvent(state, buildEvent('push_window_preview', '桌宠正在准备视频场景推窗口提醒。'));
    state.pushWindowGuard = {
      ...state.pushWindowGuard,
      lastPreviewAt: new Date().toISOString()
    };
    broadcastState();
    await new Promise((resolve) => setTimeout(resolve, Number(state.preferences.pushWindowPreviewSeconds || 2) * 1000));
    const moved = await pushForegroundWindowIfSafe();
    if (moved) addEvent('push_window_executed', '前台视频窗口已按用户开启的求关注行为轻推。');
  }
  const aiAction = await askDeepSeekForAction(event);
  if (aiAction) {
    state = {
      ...state,
      runtime: {
        ...state.runtime,
        bubble: aiAction.bubble || state.runtime.bubble,
        status: aiAction.status || state.runtime.status,
        emotion: aiAction.emotion || state.runtime.emotion
      }
    };
    addEvent('deepseek_decision', 'DeepSeek 返回了通过结构校验的桌宠高层决策。');
  }
  broadcastState();
  return state;
}

function startFollowMouseInteraction() {
  if (!petWindow || !state.preferences.playfulEnabled || state.preferences.dnd) return;
  clearInterval(followMouseTimer);
  let ticks = 0;
  followMouseTimer = setInterval(() => {
    if (!petWindow || ticks > 70) {
      clearInterval(followMouseTimer);
      followMouseTimer = null;
      return;
    }
    ticks += 1;
    const point = screen.getCursorScreenPoint();
    const bounds = petWindow.getBounds();
    const targetX = point.x - Math.round(bounds.width / 2);
    const targetY = point.y - Math.round(bounds.height / 2);
    const nextX = Math.round(bounds.x + (targetX - bounds.x) * 0.18);
    const nextY = Math.round(bounds.y + (targetY - bounds.y) * 0.18);
    petWindow.setPosition(nextX, nextY, false);
  }, 80);
}

function pauseInteractions() {
  state = {
    ...state,
    runtime: {
      ...state.runtime,
      pausedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      status: '已暂停',
      bubble: '我会安静一小时。'
    }
  };
  broadcastState();
}

function userAssetsDir() {
  const dir = path.join(app.getPath('userData'), 'assets');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function validateAssetFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const stat = fs.statSync(filePath);
  const image = nativeImage.createFromPath(filePath);
  const size = image.isEmpty() ? { width: 0, height: 0 } : image.getSize();
  const issues = [];
  const warnings = [];
  const frameEstimate = ext === '.gif' || ext === '.webp' ? 'animated-or-static' : 'single-frame';

  if (!supportedAssetExts.includes(ext)) issues.push('不支持这个文件格式。');
  if (stat.size > 20 * 1024 * 1024) issues.push('文件超过 20MB。');
  if (image.isEmpty()) issues.push('文件无法解析为图片。');
  if (!image.isEmpty() && (size.width < 32 || size.height < 32)) issues.push('图片小于 32x32。');
  if (!image.isEmpty() && (size.width > 2048 || size.height > 2048)) warnings.push('图片较大，建议导出为 2048px 以下。');
  if (!['.png', '.gif', '.webp'].includes(ext)) warnings.push('桌宠素材建议使用透明 PNG/GIF/WebP。');

  return {
    ok: issues.length === 0,
    issues,
    warnings,
    bytes: stat.size,
    width: size.width,
    height: size.height,
    ext,
    frameEstimate
  };
}

function validatePackageManifest(manifest, kind, packageDir) {
  const issues = [];
  const warnings = [];
  if (!manifest || typeof manifest !== 'object') {
    issues.push('清单文件不是 JSON 对象。');
    return { status: '失败', issues, warnings, checkedAt: new Date().toISOString() };
  }
  if (kind === 'character') {
    if (manifest.kind && manifest.kind !== 'desktop-pet-character') warnings.push(`未预期的类型：${manifest.kind}`);
    if (!manifest.character || typeof manifest.character !== 'object') issues.push('缺少角色对象。');
    if (manifest.character && !manifest.character.displayName) warnings.push('角色显示名称为空。');
  }
  if (kind === 'assets') {
    if (manifest.kind && manifest.kind !== 'desktop-pet-assets') warnings.push(`未预期的类型：${manifest.kind}`);
    if (!Array.isArray(manifest.assetSlots)) issues.push('缺少动作槽数组。');
    const knownSlotIds = new Set(state.assetSlots.map((slot) => slot.id));
    const seen = new Set();
    for (const slot of manifest.assetSlots || []) {
      if (!slot.id) {
        issues.push('有动作槽缺少 id。');
        continue;
      }
      if (seen.has(slot.id)) warnings.push(`重复的动作槽 id：${slot.id}`);
      seen.add(slot.id);
      if (!knownSlotIds.has(slot.id)) warnings.push(`未知动作槽 id：${slot.id}`);
      if (slot.assetPath) {
        const source = path.isAbsolute(slot.assetPath) ? slot.assetPath : path.join(packageDir, slot.assetPath);
        if (!fs.existsSync(source)) {
          issues.push(`缺少 ${slot.id} 的素材文件：${slot.assetPath}`);
        } else {
          const ext = path.extname(source).toLowerCase();
          if (!supportedAssetExts.includes(ext)) warnings.push(`${slot.id} 使用了不支持的扩展名：${ext}`);
        }
      }
    }
  }
  return {
    status: issues.length ? '失败' : warnings.length ? '有提醒' : '通过',
    issues,
    warnings,
    checkedAt: new Date().toISOString()
  };
}

function copyAssetToUserData(sourcePath, slotId) {
  const ext = path.extname(sourcePath) || '.png';
  const target = path.join(userAssetsDir(), `${slotId}-${Date.now()}${ext}`);
  fs.copyFileSync(sourcePath, target);
  const validation = validateAssetFile(target);
  return {
    assetPath: target,
    assetUrl: pathToFileURL(target).toString(),
    validation
  };
}

function syncSpriteRunPreviewsToAssetSlots(runDir, actions = []) {
  const previewDir = path.join(runDir, 'qa', 'previews');
  const imported = new Map();
  for (const action of actions) {
    const slotId = String(action?.id || '').trim();
    if (!slotId) continue;
    const previewPath = path.join(previewDir, `${slotId}.gif`);
    if (!fs.existsSync(previewPath)) continue;
    const copied = copyAssetToUserData(previewPath, slotId);
    imported.set(slotId, {
      ...copied,
      status: copied.validation.ok ? '已配置' : '需要修复',
      updatedAt: new Date().toISOString()
    });
  }
  if (!imported.size) return state.assetSlots;
  return state.assetSlots.map((slot) => {
    const copied = imported.get(slot.id);
    return copied ? { ...slot, ...copied } : slot;
  });
}

function runPowerShell(command, timeout = 5000) {
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
      windowsHide: true,
      timeout
    }, (error, stdout) => {
      if (error) resolve(null);
      else resolve(stdout.trim());
    });
  });
}

function runPython(args, timeout = 120000) {
  return new Promise((resolve, reject) => {
    execFile(process.env.PYTHON || 'python', args, {
      windowsHide: true,
      timeout,
      cwd: path.join(__dirname, '../..')
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || stdout?.trim() || error.message));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function classifyForeground(processName = '', title = '') {
  const name = processName.toLowerCase();
  const safeTitle = title.toLowerCase();
  if (['code', 'cursor', 'devenv', 'webstorm', 'idea', 'pycharm'].some((item) => name.includes(item))) return 'coding';
  if (['winword', 'excel', 'powerpnt', 'wps', 'et', 'wpp'].some((item) => name.includes(item))) return 'office';
  if (['wechat', 'qq', 'slack', 'teams', 'discord'].some((item) => name.includes(item))) return 'social';
  if (['zoom', 'tencentmeeting', 'meeting', 'teams'].some((item) => name.includes(item))) return 'meeting';
  if (['steam', 'epicgameslauncher'].some((item) => name.includes(item))) return 'game';
  if (['vlc', 'potplayer', 'mpv', 'iina', 'potplayermini64'].some((item) => name.includes(item))) return 'video';
  if (['chrome', 'msedge', 'firefox', 'brave'].some((item) => name.includes(item))) {
    if (['youtube', 'bilibili', 'netflix', 'video', '直播', '视频'].some((item) => safeTitle.includes(item))) return 'video';
    return 'browser';
  }
  return 'other';
}

function summarizeWindowTitle(title = '', category = 'other') {
  if (!title) return '';
  return `窗口标题已按隐私设置隐藏；分类=${category}`;
}

function preferenceNumber(key, fallback) {
  const value = Number(state.preferences?.[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function proactiveCooldownMs() {
  return preferenceNumber('proactiveCooldownMinutes', 45) * 60 * 1000;
}

function proactivePaused() {
  if (!state.preferences.proactiveEnabled) return true;
  if (state.preferences.dnd) return true;
  if (state.runtime.pausedUntil && new Date(state.runtime.pausedUntil).getTime() > Date.now()) return true;
  return false;
}

async function evaluateProactiveEvents({ idleSeconds, foregroundCategory }) {
  if (proactiveBusy || proactivePaused()) return;
  proactiveBusy = true;
  try {
    const now = Date.now();
    const cooldown = proactiveCooldownMs();
    const workCategories = new Set(['coding', 'office', 'browser']);
    const isActive = idleSeconds < 60;
    const isWork = workCategories.has(foregroundCategory);

    if (isActive && isWork) {
      proactiveState.activeWorkStartedAt ||= now;
      proactiveState.lastHydrationAt ||= now;
      const focusMs = preferenceNumber('workFocusReminderMinutes', 50) * 60 * 1000;
      if (now - proactiveState.activeWorkStartedAt >= focusMs && now - proactiveState.lastFocusReminderAt >= cooldown) {
        const activeWorkMinutes = Math.round((now - proactiveState.activeWorkStartedAt) / 60000);
        proactiveState.lastFocusReminderAt = now;
        proactiveState.activeWorkStartedAt = now;
        await triggerProactiveCandidate('work_focus_long', {
          idleSeconds,
          foregroundCategory,
          activeWorkMinutes
        });
      }
      const hydrationMs = preferenceNumber('hydrationReminderMinutes', 90) * 60 * 1000;
      if (now - proactiveState.lastHydrationAt >= hydrationMs && now - proactiveState.lastFocusReminderAt >= 5 * 60 * 1000) {
        const minutesSinceHydration = Math.round((now - proactiveState.lastHydrationAt) / 60000);
        proactiveState.lastHydrationAt = now;
        await triggerProactiveCandidate('hydration_reminder', {
          idleSeconds,
          foregroundCategory,
          minutesSinceHydration
        });
      }
    } else if (!isActive || !isWork) {
      proactiveState.activeWorkStartedAt = null;
    }

    const awaySeconds = preferenceNumber('awayLongSeconds', 900);
    if (idleSeconds >= awaySeconds && !proactiveState.wasAway && now - proactiveState.lastAwayEventAt >= cooldown) {
      proactiveState.wasAway = true;
      proactiveState.lastAwayEventAt = now;
      await triggerProactiveCandidate('user_away_long', {
        idleSeconds,
        foregroundCategory
      });
    }

    const returnSeconds = preferenceNumber('returnGreetingIdleSeconds', 180);
    if (proactiveState.wasAway && idleSeconds <= 15) {
      proactiveState.wasAway = false;
      if (returnSeconds > 0 && now - proactiveState.lastReturnEventAt >= 5 * 60 * 1000) {
        proactiveState.lastReturnEventAt = now;
        await triggerProactiveCandidate('user_returned', {
          idleSeconds,
          foregroundCategory
        });
      }
    }

    const videoSeconds = preferenceNumber('videoAttentionIdleSeconds', 1200);
    if (foregroundCategory === 'video' && idleSeconds >= videoSeconds && now - proactiveState.lastVideoAttentionAt >= cooldown) {
      proactiveState.lastVideoAttentionAt = now;
      await triggerProactiveCandidate('video_attention', {
        idleSeconds,
        foregroundCategory,
        pushWindowEnabled: state.preferences.pushWindowEnabled
      });
    }
  } finally {
    proactiveBusy = false;
  }
}

async function getForegroundInfo() {
  const script = `
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class WinApi {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@
$h=[WinApi]::GetForegroundWindow()
$sb=New-Object System.Text.StringBuilder 512
[void][WinApi]::GetWindowText($h,$sb,$sb.Capacity)
$pidNum=0
[void][WinApi]::GetWindowThreadProcessId($h,[ref]$pidNum)
$p=Get-Process -Id $pidNum -ErrorAction SilentlyContinue
[PSCustomObject]@{process=$p.ProcessName; title=$sb.ToString()} | ConvertTo-Json -Compress
`;
  const output = await runPowerShell(script);
  if (!output) return null;
  try {
    return JSON.parse(output);
  } catch {
    return null;
  }
}

function resetPushGuardIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (state.pushWindowGuard?.date === today) return;
  state = {
    ...state,
    pushWindowGuard: {
      date: today,
      usedToday: 0,
      lastPreviewAt: null,
      lastExecutedAt: null,
      lastBlockedReason: ''
    }
  };
}

function updatePushGuard(reason = '') {
  resetPushGuardIfNeeded();
  state = {
    ...state,
    pushWindowGuard: {
      ...state.pushWindowGuard,
      lastBlockedReason: reason || state.pushWindowGuard.lastBlockedReason
    }
  };
}

function weatherEventFor(current = {}) {
  const desc = String(current.weatherDesc?.[0]?.value || '').toLowerCase();
  const temp = Number(current.temp_C);
  if (desc.includes('rain') || desc.includes('shower') || desc.includes('drizzle') || desc.includes('storm')) return 'rainy_weather';
  if (Number.isFinite(temp) && temp >= 30) return 'hot_weather';
  if (Number.isFinite(temp) && temp <= 5) return 'cold_weather';
  return '';
}

async function refreshWeatherFromIp({ source = 'auto' } = {}) {
  if (!state.privacy.weather) return state;
  try {
    const response = await fetch('https://wttr.in/?format=j1');
    const data = await response.json();
    const current = data.current_condition?.[0] || {};
    const nearest = data.nearest_area?.[0] || {};
    const area = nearest.areaName?.[0]?.value || '';
    const country = nearest.country?.[0]?.value || '';
    state = {
      ...state,
      weather: {
        status: source === 'manual' ? '已刷新' : '已自动刷新',
        location: [area, country].filter(Boolean).join(', '),
        temperature: current.temp_C ? `${current.temp_C} 摄氏度` : '',
        summary: current.weatherDesc?.[0]?.value || '',
        lastUpdatedAt: new Date().toISOString()
      }
    };
    addEvent('weather_refreshed', source === 'manual'
      ? '已通过基于 IP 的公开天气源刷新天气。'
      : '已通过基于 IP 的公开天气源自动刷新天气。');

    const eventType = weatherEventFor(current);
    const weatherKey = eventType ? `${eventType}:${new Date().toISOString().slice(0, 10)}` : '';
    if (eventType && weatherKey !== lastWeatherEventKey) {
      lastWeatherEventKey = weatherKey;
      state = applyEvent(state, buildEvent(eventType, `天气条件匹配：${state.weather.summary || state.weather.temperature}`));
    }
  } catch (error) {
    state = {
      ...state,
      weather: {
        ...state.weather,
        status: `刷新失败：${error.message}`,
        lastUpdatedAt: new Date().toISOString()
      }
    };
  }
  broadcastState();
  return state;
}

async function pushForegroundWindowIfSafe() {
  resetPushGuardIfNeeded();
  const info = await getForegroundInfo();
  if (!info) {
    updatePushGuard('无法读取前台窗口');
    return false;
  }
  const category = classifyForeground(info.process, info.title);
  if (!state.preferences.pushWindowEnabled) {
    updatePushGuard('推窗口功能未开启');
    return false;
  }
  if (!state.preferences.playfulEnabled) {
    updatePushGuard('调皮互动未开启');
    return false;
  }
  if (state.preferences.dnd) {
    updatePushGuard('免打扰已开启');
    return false;
  }
  if (category !== 'video') {
    updatePushGuard(`前台不是视频场景：${category}`);
    return false;
  }
  if ((state.pushWindowGuard.usedToday || 0) >= Number(state.preferences.pushWindowDailyLimit || 2)) {
    updatePushGuard('已达到每日上限');
    return false;
  }

  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinApi {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool repaint);
}
public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
"@
$h=[WinApi]::GetForegroundWindow()
$r=New-Object RECT
[void][WinApi]::GetWindowRect($h,[ref]$r)
$w=$r.Right-$r.Left
$hgt=$r.Bottom-$r.Top
[void][WinApi]::MoveWindow($h,$r.Left+36,$r.Top+24,$w,$hgt,$true)
`;
  await runPowerShell(script);
  state = {
    ...state,
    pushWindowGuard: {
      ...state.pushWindowGuard,
      usedToday: (state.pushWindowGuard.usedToday || 0) + 1,
      lastExecutedAt: new Date().toISOString(),
      lastBlockedReason: ''
    }
  };
  return true;
}

function startPomodoroSession() {
  state = {
    ...state,
    pomodoro: {
      ...state.pomodoro,
      status: 'focus_running',
      startedAt: new Date().toISOString(),
      remainingSeconds: state.pomodoro.focusMinutes * 60
    },
    runtime: {
      ...state.runtime,
      status: '番茄钟专注中',
      animation: 'focus-working',
      bubble: '你专注的时候，我会安静陪着。'
    },
    events: [buildEvent('pomodoro_started', '番茄钟已开始。'), ...state.events]
  };
  startPomodoroTimer();
  broadcastState();
  return state;
}

function startPomodoroTimer() {
  clearInterval(pomodoroTimer);
  pomodoroTimer = setInterval(() => {
    if (state.pomodoro.status !== 'focus_running' && state.pomodoro.status !== 'break_running') return;
    const remainingSeconds = Math.max(0, state.pomodoro.remainingSeconds - 1);
    state = { ...state, pomodoro: { ...state.pomodoro, remainingSeconds } };
    if (remainingSeconds === 0) {
      state = {
        ...state,
        pomodoro: {
          ...state.pomodoro,
          status: 'completed',
          completedToday: state.pomodoro.completedToday + 1
        }
      };
      state = applyEvent(state, buildEvent('pomodoro_completed', '番茄钟倒计时已完成。'));
    }
    broadcastState();
  }, 1000);
}

function startMemoTimer() {
  clearInterval(memoTimer);
  memoTimer = setInterval(() => {
    const now = Date.now();
    let changed = false;
    const memos = state.memos.map((memo) => {
      if (memo.status === 'pending' && memo.dueAt && new Date(memo.dueAt).getTime() <= now) {
        changed = true;
        return { ...memo, status: 'due' };
      }
      return memo;
    });
    if (changed) {
      state = { ...state, memos };
      state = applyEvent(state, buildEvent('memo_due', '有一条定时备忘录到点了。'));
      broadcastState();
    }
  }, 15000);
}

function startSystemStatusTimer() {
  clearInterval(systemTimer);
  systemTimer = setInterval(async () => {
    const memory = process.getSystemMemoryInfo?.();
    const foreground = await getForegroundInfo();
    const foregroundCategory = foreground ? classifyForeground(foreground.process, foreground.title) : state.systemStatus.foregroundCategory;
    const idleSeconds = powerMonitor.getSystemIdleTime();
    state = {
      ...state,
      systemStatus: {
        ...state.systemStatus,
        idleSeconds,
        memoryMb: memory ? Math.round((memory.total - memory.free) / 1024) : state.systemStatus.memoryMb,
        processMemoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        battery: powerMonitor.isOnBatteryPower?.() ? '电池供电' : '已接通电源',
        foregroundCategory,
        foregroundProcess: foreground?.process || state.systemStatus.foregroundProcess,
        foregroundTitleSafe: foreground?.title ? summarizeWindowTitle(foreground.title, foregroundCategory) : state.systemStatus.foregroundTitleSafe,
        lastUpdatedAt: new Date().toISOString()
      }
    };
    resetPushGuardIfNeeded();
    await evaluateProactiveEvents({ idleSeconds, foregroundCategory });
    broadcastState();
  }, 10000);
}

function startWeatherTimer() {
  clearInterval(weatherTimer);
  refreshWeatherFromIp({ source: 'auto' });
  weatherTimer = setInterval(() => {
    refreshWeatherFromIp({ source: 'auto' });
  }, 60 * 60 * 1000);
}

function startAgentServer() {
  if (agentServer) return;
  const host = state.agentBridge.host || '127.0.0.1';
  const port = Number(state.agentBridge.port || 28777);
  agentServer = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/agent-event') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'not_found' }));
      return;
    }
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const type = payload.type || payload.event || 'agent_task_completed';
        const summary = payload.summary || payload.message || `收到智能体事件：${type}`;
        state = applyEvent(state, buildEvent(type, summary, payload.source || 'agent_bridge'));
        askDeepSeekForAction(state.events[0]).then((aiAction) => {
          if (aiAction) {
            state = {
              ...state,
              runtime: {
                ...state.runtime,
                bubble: aiAction.bubble || state.runtime.bubble,
                status: aiAction.status || state.runtime.status,
                emotion: aiAction.emotion || state.runtime.emotion
              }
            };
          }
          broadcastState();
        });
        broadcastState();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
      }
    });
  });
  agentServer.listen(port, host, () => {
    state = {
      ...state,
      agentBridge: {
        ...state.agentBridge,
        status: '运行中',
        endpoint: `http://${host}:${port}/agent-event`
      }
    };
    broadcastState();
  });
  agentServer.on('error', (error) => {
    state = {
      ...state,
      agentBridge: {
        ...state.agentBridge,
        status: `启动失败：${error.code || error.message}`
      }
    };
    broadcastState();
  });
}

function stopAgentServer() {
  if (!agentServer) return;
  agentServer.close();
  agentServer = null;
}

function restartAgentServer() {
  stopAgentServer();
  state = { ...state, agentBridge: { ...state.agentBridge, status: '正在重启' } };
  startAgentServer();
  broadcastState();
  return state;
}

function buildPetContextMenu() {
  return Menu.buildFromTemplate([
    { label: '打开控制面板', click: () => showPanel() },
    { label: state.preferences.miniMode ? '退出迷你模式' : '进入迷你模式', click: () => setPreference('miniMode', !state.preferences.miniMode) },
    { label: state.preferences.dnd ? '关闭免打扰' : '开启免打扰', click: () => setPreference('dnd', !state.preferences.dnd) },
    { type: 'separator' },
    { label: '开始番茄钟', click: () => startPomodoroSession() },
    { label: '新建备忘录', click: () => showPanel() },
    { label: '今天安静一点', click: () => pauseInteractions() },
    { type: 'separator' },
    { label: '测试：智能体完成', click: () => triggerEvent('agent_task_completed') },
    { label: '测试：视频求关注', click: () => triggerEvent('video_attention') },
    { type: 'separator' },
    { label: '隐藏桌宠', click: () => togglePet() }
  ]);
}

async function exportPackage(kind) {
  const result = await dialog.showOpenDialog(panelWindow, {
    title: kind === 'character' ? '选择角色包导出文件夹' : '选择动作包导出文件夹',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return state;
  const dir = path.join(result.filePaths[0], kind === 'character' ? `character-${state.character.id}` : 'asset-pack');
  fs.mkdirSync(dir, { recursive: true });
  const assetsDir = path.join(dir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  const manifest = kind === 'character'
    ? {
      kind: 'desktop-pet-character',
      exportedAt: new Date().toISOString(),
      character: state.character,
      memories: state.memories,
      preferences: {
        interactionLevel: state.preferences.interactionLevel,
        miniEdge: state.preferences.miniEdge
      }
    }
    : {
      kind: 'desktop-pet-assets',
      exportedAt: new Date().toISOString(),
      assetSlots: state.assetSlots.map((slot) => {
        if (!slot.assetPath || !fs.existsSync(slot.assetPath)) return slot;
        const fileName = path.basename(slot.assetPath);
        fs.copyFileSync(slot.assetPath, path.join(assetsDir, fileName));
        return { ...slot, assetPath: `assets/${fileName}`, assetUrl: null };
      })
    };

  fs.writeFileSync(path.join(dir, 'desktop-pet-package.json'), JSON.stringify(manifest, null, 2), 'utf8');
  addEvent(`${kind}_package_exported`, `已导出包到：${dir}`);
  broadcastState();
  return state;
}

async function importPackage(kind) {
  const result = await dialog.showOpenDialog(panelWindow, {
    title: kind === 'character' ? '选择角色包清单文件' : '选择动作包清单文件',
    properties: ['openFile'],
    filters: [
      { name: '桌宠包', extensions: ['json'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePaths[0]) return state;
  const manifestPath = result.filePaths[0];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const packageDir = path.dirname(manifestPath);
  const validation = validatePackageManifest(manifest, kind, packageDir);
  state = { ...state, packageValidation: validation };
  if (validation.issues.length) {
    addEvent('package_validation_failed', validation.issues.join('; '));
    broadcastState();
    return state;
  }

  if (kind === 'character' && manifest.character) {
    state = {
      ...state,
      character: { ...state.character, ...manifest.character },
      memories: { ...state.memories, ...(manifest.memories || {}) }
    };
    addEvent('character_package_imported', `已导入角色包：${manifest.character.displayName || manifest.character.id}`);
  }

  if (kind === 'assets' && Array.isArray(manifest.assetSlots)) {
    const slotMap = new Map(manifest.assetSlots.map((slot) => [slot.id, slot]));
    state = {
      ...state,
      assetSlots: state.assetSlots.map((slot) => {
        const imported = slotMap.get(slot.id);
        if (!imported) return slot;
        if (!imported.assetPath) return { ...slot, ...imported };
        const source = path.isAbsolute(imported.assetPath) ? imported.assetPath : path.join(packageDir, imported.assetPath);
        if (!fs.existsSync(source)) return { ...slot, ...imported, status: '素材缺失' };
        const copied = copyAssetToUserData(source, slot.id);
        return { ...slot, ...imported, ...copied, status: copied.validation.ok ? '已配置' : '需要修复' };
      })
    };
    addEvent('asset_package_imported', `已导入动作包：${path.basename(packageDir)}`);
  }

  broadcastState();
  return state;
}

function generateHookScripts() {
  const dir = path.join(app.getPath('userData'), 'hooks');
  fs.mkdirSync(dir, { recursive: true });
  const endpoint = state.agentBridge.endpoint || `http://${state.agentBridge.host}:${state.agentBridge.port}/agent-event`;
  const script = `
param(
  [string]$Type = "agent_task_completed",
  [string]$Summary = "Agent event",
  [string]$Source = "manual_hook"
)
$body = @{ type = $Type; summary = $Summary; source = $Source } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "${endpoint}" -Method Post -ContentType "application/json" -Body $body | Out-Null
`;
  const codexPath = path.join(dir, 'codex-agent-event-hook.ps1');
  const claudePath = path.join(dir, 'claude-agent-event-hook.ps1');
  fs.writeFileSync(codexPath, script, 'utf8');
  fs.writeFileSync(claudePath, script, 'utf8');
  state = {
    ...state,
    hookScripts: {
      ...state.hookScripts,
      status: '已生成',
      codexPath,
      claudePath,
      endpoint
    }
  };
  addEvent('hook_scripts_generated', '智能体事件辅助脚本已生成。');
  broadcastState();
  return state;
}

function scanHookTargets() {
  const home = app.getPath('home');
  const candidates = [
    {
      product: 'Codex',
      type: 'config',
      path: path.join(home, '.codex', 'config.toml'),
      exists: fs.existsSync(path.join(home, '.codex', 'config.toml')),
      writeMode: 'snippet-only'
    },
    {
      product: 'Codex',
      type: 'hooks-folder',
      path: path.join(home, '.codex', 'hooks'),
      exists: fs.existsSync(path.join(home, '.codex', 'hooks')),
      writeMode: 'safe-create-folder'
    },
    {
      product: 'Claude Code',
      type: 'settings',
      path: path.join(home, '.claude', 'settings.json'),
      exists: fs.existsSync(path.join(home, '.claude', 'settings.json')),
      writeMode: 'snippet-only'
    },
    {
      product: 'Claude Code',
      type: 'project-settings',
      path: path.join(process.cwd(), '.claude', 'settings.local.json'),
      exists: fs.existsSync(path.join(process.cwd(), '.claude', 'settings.local.json')),
      writeMode: 'snippet-only'
    }
  ];
  state = {
    ...state,
    hookScripts: {
      ...state.hookScripts,
      configCandidates: candidates,
      installStatus: `已发现 ${candidates.filter((item) => item.exists).length}/${candidates.length} 个事件脚本配置位置`
    }
  };
  addEvent('hook_targets_scanned', state.hookScripts.installStatus);
  broadcastState();
  return state;
}

function generateHookConfigSnippets() {
  if (!state.hookScripts.codexPath || !state.hookScripts.claudePath) generateHookScripts();
  const dir = path.join(app.getPath('userData'), 'hooks');
  fs.mkdirSync(dir, { recursive: true });
  const codexSnippetPath = path.join(dir, 'codex-config-snippet.toml');
  const claudeSnippetPath = path.join(dir, 'claude-settings-snippet.json');
  const codexSnippet = [
    '# 桌宠 2.0 事件脚本配置片段',
    '# 如果你的 Codex 版本支持命令钩子，可以把下面内容粘贴到 Codex 配置中。',
    '[hooks]',
    `agent_task_completed = 'powershell -ExecutionPolicy Bypass -File "${state.hookScripts.codexPath}" -Type agent_task_completed -Summary "任务已完成" -Source codex'`,
    `agent_permission_waiting = 'powershell -ExecutionPolicy Bypass -File "${state.hookScripts.codexPath}" -Type agent_permission_waiting -Summary "需要权限" -Source codex'`,
    `agent_error = 'powershell -ExecutionPolicy Bypass -File "${state.hookScripts.codexPath}" -Type agent_error -Summary "智能体报错" -Source codex'`
  ].join('\n');
  const claudeSnippet = {
    hooks: {
      Stop: [{
        matcher: '*',
        hooks: [{
          type: 'command',
          command: `powershell -ExecutionPolicy Bypass -File "${state.hookScripts.claudePath}" -Type agent_task_completed -Summary "任务已完成" -Source claude_code`
        }]
      }],
      Notification: [{
        matcher: '*',
        hooks: [{
          type: 'command',
          command: `powershell -ExecutionPolicy Bypass -File "${state.hookScripts.claudePath}" -Type agent_permission_waiting -Summary "通知提醒" -Source claude_code`
        }]
      }]
    }
  };
  fs.writeFileSync(codexSnippetPath, codexSnippet, 'utf8');
  fs.writeFileSync(claudeSnippetPath, JSON.stringify(claudeSnippet, null, 2), 'utf8');
  state = {
    ...state,
    hookScripts: {
      ...state.hookScripts,
      snippetDir: dir,
      snippets: [codexSnippetPath, claudeSnippetPath],
      installStatus: `配置片段已生成：${dir}`
    }
  };
  addEvent('hook_config_snippets_generated', state.hookScripts.installStatus);
  broadcastState();
  return state;
}

function desktopPetClaudeHookEntries() {
  if (!state.hookScripts.claudePath) generateHookScripts();
  return {
    Stop: [{
      matcher: '*',
      hooks: [{
        type: 'command',
          command: `powershell -ExecutionPolicy Bypass -File "${state.hookScripts.claudePath}" -Type agent_task_completed -Summary "任务已完成" -Source claude_code_desktop_pet_2`
      }]
    }],
    Notification: [{
      matcher: '*',
      hooks: [{
        type: 'command',
          command: `powershell -ExecutionPolicy Bypass -File "${state.hookScripts.claudePath}" -Type agent_permission_waiting -Summary "通知提醒" -Source claude_code_desktop_pet_2`
      }]
    }]
  };
}

function readJsonFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const text = fs.readFileSync(filePath, 'utf8').trim();
  if (!text) return {};
  return JSON.parse(text);
}

function backupFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const backupPath = `${filePath}.desktop-pet-backup-${Date.now()}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function removeDesktopPetHookEntries(settings) {
  const next = { ...settings, hooks: { ...(settings.hooks || {}) } };
  for (const eventName of Object.keys(next.hooks)) {
    const groups = Array.isArray(next.hooks[eventName]) ? next.hooks[eventName] : [];
    const filteredGroups = groups.map((group) => ({
      ...group,
      hooks: (group.hooks || []).filter((hook) => !String(hook.command || '').includes('desktop_pet_2'))
    })).filter((group) => (group.hooks || []).length > 0);
    if (filteredGroups.length) next.hooks[eventName] = filteredGroups;
    else delete next.hooks[eventName];
  }
  if (!Object.keys(next.hooks).length) delete next.hooks;
  return next;
}

function installClaudeProjectHook() {
  generateHookScripts();
  const projectClaudeDir = path.join(process.cwd(), '.claude');
  fs.mkdirSync(projectClaudeDir, { recursive: true });
  const settingsPath = path.join(projectClaudeDir, 'settings.local.json');
  const backupPath = backupFileIfExists(settingsPath);
  const existing = readJsonFileIfExists(settingsPath);
  const cleaned = removeDesktopPetHookEntries(existing);
  const entries = desktopPetClaudeHookEntries();
  const next = { ...cleaned, hooks: { ...(cleaned.hooks || {}) } };
  for (const [eventName, groups] of Object.entries(entries)) {
    next.hooks[eventName] = [...(next.hooks[eventName] || []), ...groups];
  }
  fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2), 'utf8');
  const target = {
    product: 'Claude Code',
    scope: 'project',
    path: settingsPath,
    backupPath,
    installedAt: new Date().toISOString(),
    status: '已安装'
  };
  state = {
    ...state,
    hookScripts: {
      ...state.hookScripts,
      installStatus: `Claude 项目事件脚本已安装：${settingsPath}`,
      installedTargets: [
        target,
        ...(state.hookScripts.installedTargets || []).filter((item) => item.path !== settingsPath)
      ].slice(0, 10)
    }
  };
  addEvent('claude_project_hook_installed', state.hookScripts.installStatus);
  broadcastState();
  return state;
}

function uninstallClaudeProjectHook() {
  const settingsPath = path.join(process.cwd(), '.claude', 'settings.local.json');
  if (!fs.existsSync(settingsPath)) {
    state = {
      ...state,
      hookScripts: {
        ...state.hookScripts,
        installStatus: `未找到 Claude 项目设置：${settingsPath}`
      }
    };
    broadcastState();
    return state;
  }
  const backupPath = backupFileIfExists(settingsPath);
  const existing = readJsonFileIfExists(settingsPath);
  const next = removeDesktopPetHookEntries(existing);
  fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2), 'utf8');
  state = {
    ...state,
    hookScripts: {
      ...state.hookScripts,
      installStatus: `Claude 项目事件脚本已移除：${settingsPath}`,
      installedTargets: (state.hookScripts.installedTargets || []).map((item) => item.path === settingsPath
        ? { ...item, status: '已移除', removedAt: new Date().toISOString(), backupPath }
        : item)
    }
  };
  addEvent('claude_project_hook_removed', state.hookScripts.installStatus);
  broadcastState();
  return state;
}

function generateHookInstallInstructions() {
  if (!state.hookScripts.codexPath || !state.hookScripts.claudePath) generateHookScripts();
  const dir = path.join(app.getPath('userData'), 'hooks');
  const endpoint = state.agentBridge.endpoint || `http://${state.agentBridge.host}:${state.agentBridge.port}/agent-event`;
  const text = [
    '# 桌宠 2.0 智能体事件脚本指南',
    '',
    `本地接口：${endpoint}`,
    '',
    '当任务完成、等待权限或失败时，可以从 Codex 或 Claude Code 事件脚本调用生成的 PowerShell 脚本。',
    '',
    'Codex 示例：',
    `powershell -ExecutionPolicy Bypass -File "${state.hookScripts.codexPath}" -Type agent_task_completed -Summary "任务已完成" -Source codex`,
    '',
    'Claude Code 示例：',
    `powershell -ExecutionPolicy Bypass -File "${state.hookScripts.claudePath}" -Type agent_permission_waiting -Summary "需要权限" -Source claude_code`,
    '',
    '已生成的配置片段：',
    ...(state.hookScripts.snippets || []).map((item) => `- ${item}`),
    '',
    '隐私边界：只发送事件类型和安全摘要。不要发送键盘内容、截图、聊天正文或文件内容。'
  ].join('\n');
  const readmePath = path.join(dir, 'README.md');
  fs.writeFileSync(readmePath, text, 'utf8');
  state = {
    ...state,
    hookScripts: {
      ...state.hookScripts,
      installStatus: `说明已生成：${readmePath}`
    }
  };
  addEvent('hook_install_instructions_generated', '智能体事件脚本安装说明已生成。');
  broadcastState();
  return state;
}

function addMemo(text, dueAt) {
  const memo = {
    id: `memo_${Date.now()}`,
    text: text || '新备忘录',
    type: dueAt ? 'timed_reminder' : 'normal',
    status: 'pending',
    dueAt: dueAt || null,
    createdAt: new Date().toISOString()
  };
  state = {
    ...state,
    memos: [memo, ...state.memos]
  };
  state = applyEvent(state, buildEvent('memo_created', `备忘录已创建：${memo.text}`));
  broadcastState();
  return state;
}

function normalizePetSpriteActions(actions = []) {
  return actions.map((action) => ({
    id: String(action.id || '').trim().replace(/[^a-zA-Z0-9_-]/g, ''),
    frame_count: Math.max(1, Math.min(24, Number(action.frame_count || 1))),
    description: String(action.description || '').trim().slice(0, 1000),
    avoid: String(action.avoid || '').trim().slice(0, 500)
  })).filter((action) => action.id && action.description);
}

async function structurePetSpriteActions(config = {}) {
  if (!state.deepSeek.enabled || !state.deepSeek.apiKey) {
    throw new Error('请先在模型与性能里配置 DeepSeek 接口密钥。');
  }
  const naturalLanguage = String(config.naturalLanguage || '').trim();
  if (!naturalLanguage) throw new Error('请先填写动作需求描述。');
  const defaults = {
    petName: String(config.petName || state.character.displayName || '').trim(),
    styleNotes: String(config.styleNotes || '').trim(),
    chromaKey: String(config.chromaKey || '#0000FF').trim() || '#0000FF'
  };
  const requestPayload = {
    ...defaults,
    naturalLanguage
  };
  const response = await fetch(state.deepSeek.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.deepSeek.apiKey}`
    },
    body: JSON.stringify(deepSeekRequestBody(createSpriteActionStructureMessages(requestPayload)))
  });
  if (!response.ok) {
    addDeepSeekLog(`动作结构化失败 HTTP ${response.status}`, false, requestPayload);
    throw new Error(`DeepSeek 请求失败：HTTP ${response.status}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '';
  let parsed;
  try {
    parsed = extractJsonObject(content);
  } catch (error) {
    addDeepSeekLog(`动作结构化返回无效 JSON：${error.message}`, false, { ...requestPayload, content });
    throw error;
  }
  const normalized = normalizeStructuredSpriteActions(parsed, defaults);
  if (!normalized.ok) {
    addDeepSeekLog(`动作结构化校验失败：${normalized.errors.join('；')}`, false, { ...requestPayload, parsed });
    throw new Error(normalized.errors[0] || '动作结构化结果不可用。');
  }
  addDeepSeekLog(`动作结构化完成：${normalized.data.actions.length} 个动作`, true, {
    petName: normalized.data.pet_name,
    actionIds: normalized.data.actions.map((action) => action.id)
  });
  return normalized.data;
}

function spriteRunsDir() {
  const dir = path.join(app.getPath('userData'), 'sprite-runs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readPetSpriteJobs(runDir) {
  const statusFile = path.join(runDir, 'generation-status.json');
  if (!fs.existsSync(statusFile)) return [];
  try {
    const status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
    return (status.jobs || []).map((job) => ({
      id: String(job.id || ''),
      kind: String(job.kind || ''),
      status: String(job.status || ''),
      promptPath: String(job.prompt_path || ''),
      outputPath: String(job.output_path || ''),
      sourcePath: String(job.source_path || ''),
      repairPromptPath: String(job.repair_prompt_path || ''),
      qaNote: String(job.qa_note || ''),
      frameCount: job.frame_count || null,
      updatedAt: String(job.updated_at || '')
    }));
  } catch {
    return [];
  }
}

function getPetSpriteOutputPaths(runDir) {
  const spritesheetWebp = path.join(runDir, 'final', 'spritesheet.webp');
  const spritesheetPng = path.join(runDir, 'final', 'spritesheet.png');
  const contactSheetPath = path.join(runDir, 'qa', 'contact-sheet.png');
  return {
    spritesheetPath: fs.existsSync(spritesheetWebp) ? spritesheetWebp : (fs.existsSync(spritesheetPng) ? spritesheetPng : ''),
    contactSheetPath: fs.existsSync(contactSheetPath) ? contactSheetPath : ''
  };
}

function assertPetSpriteRunDir(runDirInput, actionLabel = '操作') {
  const runDir = String(runDirInput || state.petSpriteGenerator?.currentRunDir || '').trim();
  if (!runDir || !fs.existsSync(path.join(runDir, 'manifest.json'))) {
    throw new Error(`未找到可${actionLabel}的运行目录。`);
  }
  return runDir;
}

function refreshPetSpriteRun(runDirInput) {
  const runDir = assertPetSpriteRunDir(runDirInput, '刷新');
  const { spritesheetPath, contactSheetPath } = getPetSpriteOutputPaths(runDir);
  state = {
    ...state,
    petSpriteGenerator: {
      ...state.petSpriteGenerator,
      currentRunDir: runDir,
      status: '状态已刷新',
      lastGenerationStatusPath: path.join(runDir, 'generation-status.json'),
      lastValidationPath: path.join(runDir, 'qa', 'validation.json'),
      lastContactSheetPath: contactSheetPath,
      lastSpritesheetPath: spritesheetPath,
      generationJobs: readPetSpriteJobs(runDir),
      validationSummary: readPetSpriteValidationSummary(runDir),
      previewMedia: readPetSpritePreviewMedia(runDir)
    }
  };
  broadcastState();
  return state.petSpriteGenerator;
}

function resolvePetSpriteOpenPath(kind, runDirInput) {
  const runDir = assertPetSpriteRunDir(runDirInput, '打开');
  const openKind = String(kind || 'run');
  const { spritesheetPath, contactSheetPath } = getPetSpriteOutputPaths(runDir);
  const targets = {
    run: runDir,
    prompts: path.join(runDir, 'prompts'),
    decoded: path.join(runDir, 'decoded'),
    frames: path.join(runDir, 'frames'),
    final: path.join(runDir, 'final'),
    qa: path.join(runDir, 'qa'),
    status: path.join(runDir, 'generation-status.json'),
    validation: path.join(runDir, 'qa', 'validation.json'),
    workflow: path.join(runDir, 'workflow.md'),
    manualReview: path.join(runDir, 'qa', 'manual-review.md'),
    outputManifest: path.join(runDir, 'final', 'output-manifest.json'),
    contactSheet: contactSheetPath,
    spritesheet: spritesheetPath
  };
  const targetPath = targets[openKind];
  if (!targetPath) throw new Error('未知的打开目标。');
  if (!fs.existsSync(targetPath)) throw new Error('目标文件或目录还不存在。');

  const resolvedRunDir = path.resolve(runDir);
  const resolvedTarget = path.resolve(targetPath);
  if (resolvedTarget !== resolvedRunDir && !resolvedTarget.startsWith(`${resolvedRunDir}${path.sep}`)) {
    throw new Error('只能打开当前动作生成运行目录内的文件。');
  }
  return resolvedTarget;
}

async function openPetSpritePath(kind, runDirInput) {
  const targetPath = resolvePetSpriteOpenPath(kind, runDirInput);
  const error = await shell.openPath(targetPath);
  if (error) throw new Error(error);
  return { path: targetPath };
}

function resolvePetSpriteJobPath(config = {}) {
  const runDir = assertPetSpriteRunDir(config.runDir, '打开任务文件');
  const jobId = String(config.jobId || '').trim();
  const field = String(config.field || '').trim();
  if (!jobId) throw new Error('请指定要打开的 job。');
  const allowedFields = new Set(['promptPath', 'outputPath', 'sourcePath', 'repairPromptPath']);
  if (!allowedFields.has(field)) throw new Error('未知的任务文件类型。');
  const job = readPetSpriteJobs(runDir).find((item) => item.id === jobId);
  if (!job) throw new Error('未找到指定 job。');
  const rawPath = String(job[field] || '').trim();
  if (!rawPath) throw new Error('这个 job 暂无对应文件路径。');
  const targetPath = path.isAbsolute(rawPath) ? rawPath : path.join(runDir, rawPath);
  if (!fs.existsSync(targetPath)) throw new Error('目标文件还不存在。');

  const resolvedRunDir = path.resolve(runDir);
  const resolvedTarget = path.resolve(targetPath);
  if (resolvedTarget !== resolvedRunDir && !resolvedTarget.startsWith(`${resolvedRunDir}${path.sep}`)) {
    throw new Error('只能打开当前动作生成运行目录内的任务文件。');
  }
  return resolvedTarget;
}

async function openPetSpriteJobPath(config = {}) {
  const targetPath = resolvePetSpriteJobPath(config);
  const error = await shell.openPath(targetPath);
  if (error) throw new Error(error);
  return { path: targetPath };
}

function applyPetSpriteRun(runDirInput) {
  const runDir = assertPetSpriteRunDir(runDirInput, '应用');
  const summary = readPetSpriteRunSummary(runDir);
  const appliedSprite = buildAppliedPetSprite({
    runDir,
    manifest: readPetSpriteManifest(runDir),
    summary
  });
  const { spritesheetPath, contactSheetPath } = getPetSpriteOutputPaths(runDir);
  const assetSlots = syncSpriteRunPreviewsToAssetSlots(runDir, appliedSprite.actions);
  state = {
    ...state,
    assetSlots,
    character: {
      ...state.character,
      displayName: appliedSprite.petName || state.character.displayName
    },
    runtime: {
      ...state.runtime,
      animation: appliedSprite.actions.some((action) => action.id === state.runtime.animation) ? state.runtime.animation : 'idle',
      status: '已应用新桌宠形象',
      bubble: '新形象已经换好了。'
    },
    petSpriteGenerator: {
      ...state.petSpriteGenerator,
      currentRunDir: runDir,
      status: '已应用到桌宠形象',
      lastContactSheetPath: contactSheetPath,
      lastSpritesheetPath: spritesheetPath,
      appliedSprite,
      generationJobs: readPetSpriteJobs(runDir),
      validationSummary: readPetSpriteValidationSummary(runDir),
      previewMedia: readPetSpritePreviewMedia(runDir)
    }
  };
  addEvent('pet_sprite_applied', `桌宠新形象已应用：${appliedSprite.spritesheetPath}`);
  broadcastState();
  return appliedSprite;
}

async function createPetSpriteRun(config = {}) {
  const referencePath = String(config.referencePath || '').trim();
  const petName = String(config.petName || state.character.displayName || 'desktop-pet').trim().slice(0, 48);
  const styleNotes = String(config.styleNotes || '').trim().slice(0, 1000);
  const chromaKey = String(config.chromaKey || '#0000FF').trim() || '#0000FF';
  const actions = normalizePetSpriteActions(config.actions || []);
  if (!referencePath || !fs.existsSync(referencePath)) throw new Error('请先选择一张角色参考图。');
  if (!actions.length) throw new Error('请至少填写一个动作。');

  const safeName = petName.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'pet';
  const runDir = path.join(spriteRunsDir(), `${safeName}-${Date.now()}`);
  fs.mkdirSync(runDir, { recursive: true });
  const actionsPath = path.join(runDir, 'actions-input.json');
  fs.writeFileSync(actionsPath, JSON.stringify({ actions }, null, 2), 'utf8');
  const scriptPath = path.join(__dirname, '../../scripts/pet_action_pipeline.py');
  const stdout = await runPython([
    scriptPath,
    'init',
    '--reference-image', referencePath,
    '--pet-name', petName,
    '--style-notes', styleNotes,
    '--actions', actionsPath,
    '--output-dir', runDir,
    '--chroma-key', chromaKey
  ]);
  const result = JSON.parse(stdout);
  const runRecord = {
    runDir,
    petName,
    actionCount: actions.length,
    createdAt: new Date().toISOString(),
    status: '已创建'
  };
  state = {
    ...state,
    petSpriteGenerator: {
      ...state.petSpriteGenerator,
      referencePath,
      currentRunDir: runDir,
      status: '运行目录已创建',
      lastGenerationStatusPath: path.join(runDir, 'generation-status.json'),
      lastValidationPath: path.join(runDir, 'qa', 'validation.json'),
      lastContactSheetPath: '',
      lastSpritesheetPath: '',
      generationJobs: readPetSpriteJobs(runDir),
      validationSummary: readPetSpriteValidationSummary(runDir),
      previewMedia: readPetSpritePreviewMedia(runDir),
      recentRuns: [runRecord, ...(state.petSpriteGenerator?.recentRuns || [])].slice(0, 8)
    }
  };
  addEvent('pet_sprite_run_created', `桌宠动作生成运行目录已创建：${runDir}`);
  broadcastState();
  return { ...result, runDir };
}

async function markPetSpriteJob(config = {}) {
  const runDir = String(config.runDir || state.petSpriteGenerator?.currentRunDir || '').trim();
  const jobId = String(config.jobId || '').trim();
  const status = String(config.status || '').trim();
  const sourcePath = String(config.sourcePath || '').trim();
  const qaNote = String(config.qaNote || '').trim();
  if (!runDir || !fs.existsSync(path.join(runDir, 'manifest.json'))) throw new Error('未找到可登记的运行目录。');
  if (!jobId) throw new Error('请填写要登记的 job id。');
  if (!status) throw new Error('请填写生成状态。');

  const scriptPath = path.join(__dirname, '../../scripts/pet_action_pipeline.py');
  const args = [
    scriptPath,
    'mark',
    '--run-dir', runDir,
    '--job-id', jobId,
    '--status', status,
    '--updated-at', new Date().toISOString()
  ];
  if (sourcePath) args.push('--source-path', sourcePath);
  if (qaNote) args.push('--qa-note', qaNote);
  const stdout = await runPython(args);
  const result = JSON.parse(stdout);
  state = {
    ...state,
    petSpriteGenerator: {
      ...state.petSpriteGenerator,
      currentRunDir: runDir,
      status: `已登记 ${jobId}：${status}`,
      lastGenerationStatusPath: path.join(runDir, 'generation-status.json'),
      generationJobs: readPetSpriteJobs(runDir),
      validationSummary: readPetSpriteValidationSummary(runDir),
      previewMedia: readPetSpritePreviewMedia(runDir)
    }
  };
  addEvent('pet_sprite_job_marked', `桌宠动作生成结果已登记：${jobId} -> ${status}`);
  broadcastState();
  return result;
}

async function importPetSpriteJobImage(config = {}) {
  const runDir = String(config.runDir || state.petSpriteGenerator?.currentRunDir || '').trim();
  const jobId = String(config.jobId || '').trim();
  const qaNote = String(config.qaNote || '').trim();
  if (!runDir || !fs.existsSync(path.join(runDir, 'manifest.json'))) throw new Error('未找到可导入的运行目录。');
  if (!jobId) throw new Error('请填写要导入的 job id。');

  const result = await dialog.showOpenDialog(panelWindow, {
    title: `选择 ${jobId} 的生成图片`,
    properties: ['openFile'],
    filters: [
      { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const scriptPath = path.join(__dirname, '../../scripts/pet_action_pipeline.py');
  const stdout = await runPython([
    scriptPath,
    'import',
    '--run-dir', runDir,
    '--job-id', jobId,
    '--source-path', result.filePaths[0],
    '--qa-note', qaNote || '从控制面板导入生成图片',
    '--updated-at', new Date().toISOString()
  ]);
  const imported = JSON.parse(stdout);
  state = {
    ...state,
    petSpriteGenerator: {
      ...state.petSpriteGenerator,
      currentRunDir: runDir,
      status: `已导入 ${jobId}`,
      lastGenerationStatusPath: path.join(runDir, 'generation-status.json'),
      generationJobs: readPetSpriteJobs(runDir),
      validationSummary: readPetSpriteValidationSummary(runDir),
      previewMedia: readPetSpritePreviewMedia(runDir)
    }
  };
  addEvent('pet_sprite_job_imported', `桌宠动作生成图片已导入：${jobId} -> ${imported.decoded_path}`);
  broadcastState();
  return imported;
}

async function createPetSpriteRepairPrompt(config = {}) {
  const runDir = String(config.runDir || state.petSpriteGenerator?.currentRunDir || '').trim();
  const jobId = String(config.jobId || '').trim();
  const reason = String(config.reason || '').trim();
  if (!runDir || !fs.existsSync(path.join(runDir, 'manifest.json'))) throw new Error('未找到可修复的运行目录。');
  if (!jobId) throw new Error('请填写要修复的 job id。');

  const scriptPath = path.join(__dirname, '../../scripts/pet_action_pipeline.py');
  const stdout = await runPython([
    scriptPath,
    'repair',
    '--run-dir', runDir,
    '--job-id', jobId,
    '--reason', reason,
    '--updated-at', new Date().toISOString()
  ]);
  const repaired = JSON.parse(stdout);
  state = {
    ...state,
    petSpriteGenerator: {
      ...state.petSpriteGenerator,
      currentRunDir: runDir,
      status: `已生成 ${jobId} 修复提示词`,
      lastGenerationStatusPath: path.join(runDir, 'generation-status.json'),
      generationJobs: readPetSpriteJobs(runDir),
      validationSummary: readPetSpriteValidationSummary(runDir),
      previewMedia: readPetSpritePreviewMedia(runDir)
    }
  };
  addEvent('pet_sprite_repair_prompt_created', `桌宠动作修复提示词已生成：${jobId} -> ${repaired.repair_prompt_path}`);
  broadcastState();
  return repaired;
}

async function processPetSpriteRun(config = {}) {
  const runDirInput = typeof config === 'object' && config !== null ? config.runDir : config;
  const generateSpritesheet = typeof config === 'object' && config !== null && config.generateSpritesheet === false ? false : true;
  const runDir = String(runDirInput || state.petSpriteGenerator?.currentRunDir || '').trim();
  if (!runDir || !fs.existsSync(path.join(runDir, 'manifest.json'))) throw new Error('未找到可处理的运行目录。');
  const scriptPath = path.join(__dirname, '../../scripts/pet_action_pipeline.py');
  const args = [scriptPath, 'process', '--run-dir', runDir];
  if (!generateSpritesheet) args.push('--skip-spritesheet');
  const stdout = await runPython(args, 180000);
  const result = JSON.parse(stdout);
  const spritesheetPath = result.spritesheet?.webp || '';
  const contactSheetPath = result.contact_sheet || path.join(runDir, 'qa', 'contact-sheet.png');
  state = {
    ...state,
    petSpriteGenerator: {
      ...state.petSpriteGenerator,
      currentRunDir: runDir,
      status: result.ok ? '处理完成' : '处理完成但有问题',
      lastGenerationStatusPath: path.join(runDir, 'generation-status.json'),
      lastValidationPath: path.join(runDir, 'qa', 'validation.json'),
      lastContactSheetPath: fs.existsSync(contactSheetPath) ? contactSheetPath : '',
      lastSpritesheetPath: fs.existsSync(spritesheetPath) ? spritesheetPath : '',
      generationJobs: readPetSpriteJobs(runDir),
      validationSummary: readPetSpriteValidationSummary(runDir),
      previewMedia: readPetSpritePreviewMedia(runDir),
      recentRuns: (state.petSpriteGenerator?.recentRuns || []).map((item) => item.runDir === runDir
        ? { ...item, status: result.ok ? '处理完成' : '需要修复', processedAt: new Date().toISOString() }
        : item)
    }
  };
  addEvent('pet_sprite_run_processed', result.ok
    ? `桌宠动作已处理完成：${spritesheetPath}`
    : `桌宠动作处理完成但需要修复：${runDir}`);
  broadcastState();
  return result;
}

async function autoGeneratePetSpriteRun(config = {}) {
  const runDirInput = String(config.runDir || state.petSpriteGenerator?.currentRunDir || '').trim();
  const generateSpritesheet = typeof config === 'object' && config !== null && config.generateSpritesheet === false ? false : true;
  const runDir = runDirInput && fs.existsSync(path.join(runDirInput, 'manifest.json'))
    ? runDirInput
    : (await createPetSpriteRun(config)).runDir;

  const scriptPath = path.join(__dirname, '../../scripts/pet_auto_sprite_generator.py');
  const generatedStdout = await runPython([
    scriptPath,
    '--run-dir', runDir
  ], 180000);
  const generated = JSON.parse(generatedStdout);
  state = {
    ...state,
    petSpriteGenerator: {
      ...state.petSpriteGenerator,
      currentRunDir: runDir,
      status: '已自动生成动作条，正在处理 GIF',
      lastGenerationStatusPath: path.join(runDir, 'generation-status.json'),
      autoGeneration: {
        mode: generated.mode,
        path: path.join(runDir, 'auto-generation.json'),
        generatedAt: new Date().toISOString()
      },
      generationJobs: readPetSpriteJobs(runDir),
      validationSummary: readPetSpriteValidationSummary(runDir),
      previewMedia: readPetSpritePreviewMedia(runDir)
    }
  };
  broadcastState();

  const processed = await processPetSpriteRun({ runDir, generateSpritesheet });
  state = {
    ...state,
    petSpriteGenerator: {
      ...state.petSpriteGenerator,
      currentRunDir: runDir,
      status: processed.ok ? '自动生成 GIF 完成' : '自动生成完成，但有素材需要修复',
      autoGeneration: {
        ...(state.petSpriteGenerator?.autoGeneration || {}),
        processedAt: new Date().toISOString()
      },
      generationJobs: readPetSpriteJobs(runDir),
      validationSummary: readPetSpriteValidationSummary(runDir),
      previewMedia: readPetSpritePreviewMedia(runDir)
    }
  };
  addEvent('pet_sprite_auto_generated', `已从单张参考图自动生成动作 GIF：${runDir}`);
  broadcastState();
  return { runDir, generated, processed };
}

async function reviewPetSpriteRun(config = {}) {
  const runDir = assertPetSpriteRunDir(config.runDir, '记录 QA');
  const reviewStatus = String(config.status || '').trim();
  const note = String(config.note || '').trim();
  const failedJobs = Array.isArray(config.failedJobs) ? config.failedJobs.map((item) => String(item).trim()).filter(Boolean) : [];
  const checklist = config.checklist && typeof config.checklist === 'object' ? config.checklist : null;
  if (!['accepted', 'failed'].includes(reviewStatus)) throw new Error('视觉 QA 状态只能是 accepted 或 failed。');

  const scriptPath = path.join(__dirname, '../../scripts/pet_action_pipeline.py');
  const args = [
    scriptPath,
    'review',
    '--run-dir', runDir,
    '--status', reviewStatus,
    '--note', note,
    '--updated-at', new Date().toISOString()
  ];
  for (const jobId of failedJobs) {
    args.push('--failed-job', jobId);
  }
  if (checklist) {
    args.push('--checklist-json', JSON.stringify(checklist));
  }
  const stdout = await runPython(args);
  const result = JSON.parse(stdout);
  const { spritesheetPath, contactSheetPath } = getPetSpriteOutputPaths(runDir);
  state = {
    ...state,
    petSpriteGenerator: {
      ...state.petSpriteGenerator,
      currentRunDir: runDir,
      status: reviewStatus === 'accepted' ? '视觉 QA 已通过' : '视觉 QA 未通过，需要修复',
      lastGenerationStatusPath: path.join(runDir, 'generation-status.json'),
      lastValidationPath: path.join(runDir, 'qa', 'validation.json'),
      lastContactSheetPath: contactSheetPath,
      lastSpritesheetPath: spritesheetPath,
      generationJobs: readPetSpriteJobs(runDir),
      validationSummary: readPetSpriteValidationSummary(runDir),
      previewMedia: readPetSpritePreviewMedia(runDir),
      recentRuns: (state.petSpriteGenerator?.recentRuns || []).map((item) => item.runDir === runDir
        ? { ...item, status: reviewStatus === 'accepted' ? '视觉 QA 已通过' : '需要修复', reviewedAt: result.reviewed_at }
        : item)
    }
  };
  addEvent('pet_sprite_visual_review_recorded', reviewStatus === 'accepted'
    ? `桌宠动作视觉 QA 已通过：${runDir}`
    : `桌宠动作视觉 QA 未通过：${failedJobs.join(', ') || runDir}`);
  broadcastState();
  return result;
}

function quitApp() {
  app.isQuitting = true;
  saveState();
  stopAgentServer();
  clearInterval(pomodoroTimer);
  clearInterval(memoTimer);
  clearInterval(systemTimer);
  clearInterval(weatherTimer);
  clearInterval(followMouseTimer);
  tray?.destroy();
  app.quit();
}

function registerIpc() {
  ipcMain.handle('state:get', () => state);
  ipcMain.handle('state:setPreference', (_event, key, value) => setPreference(key, value));
  ipcMain.handle('state:setMiniEdge', (_event, edge) => setPreference('miniEdge', edge));
  ipcMain.handle('character:update', (_event, patch) => updateCharacter(patch));
  ipcMain.handle('pomodoro:setConfig', (_event, config) => setPomodoroConfig(config));
  ipcMain.handle('privacy:set', (_event, key, value) => setPrivacyPreference(key, value));
  ipcMain.handle('event:trigger', (_event, type) => triggerEvent(type));
  ipcMain.handle('window:showPet', () => {
    petWindow?.show();
    return true;
  });
  ipcMain.handle('pet:openMenu', () => {
    buildPetContextMenu().popup({ window: petWindow });
    return true;
  });

  ipcMain.handle('weather:refresh', async () => {
    return refreshWeatherFromIp({ source: 'manual' });
  });

  ipcMain.handle('package:exportCharacter', () => exportPackage('character'));
  ipcMain.handle('package:importCharacter', () => importPackage('character'));
  ipcMain.handle('package:exportAssets', () => exportPackage('assets'));
  ipcMain.handle('package:importAssets', () => importPackage('assets'));

  ipcMain.handle('training:draft', (_event, text, sourceType) => {
    state = { ...state, trainingDraft: createTrainingDraft(text || '', sourceType || 'text') };
    broadcastState();
    return state;
  });
  ipcMain.handle('training:importFile', async () => {
    const result = await dialog.showOpenDialog(panelWindow, {
      title: '导入角色训练材料',
      properties: ['openFile'],
      filters: [
        { name: '角色材料', extensions: ['md', 'txt', 'json'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    if (result.canceled || !result.filePaths[0]) return state;
    const filePath = result.filePaths[0];
    const text = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();
    const sourceType = ext === '.json' ? 'json' : ext === '.md' ? path.basename(filePath) : 'plain-text';
    state = { ...state, trainingDraft: createTrainingDraft(text, sourceType) };
    addEvent('training_file_imported', `已导入材料：${path.basename(filePath)}`);
    broadcastState();
    return state;
  });
  ipcMain.handle('training:accept', () => {
    if (!state.trainingDraft) return state;
    snapshotCharacter('before_training_accept');
    state = {
      ...state,
      character: {
        ...state.character,
        type: state.trainingDraft.mode === 'real_person_style_review' ? 'real_person_style' : 'inspired_by_materials',
        persona: state.trainingDraft.persona,
        voiceStyle: state.trainingDraft.voiceStyle
      },
      memories: {
        ...state.memories,
        candidate: [...state.trainingDraft.memories, ...state.memories.candidate]
      },
      trainingDraft: null
    };
    addEvent('training_accepted', '训练草稿已确认写入。');
    broadcastState();
    return state;
  });

  ipcMain.handle('asset:replace', async (_event, slotId) => {
    const result = await dialog.showOpenDialog(panelWindow, {
      title: '选择动作素材',
      properties: ['openFile'],
      filters: [
        { name: '图片或动图', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    if (result.canceled || !result.filePaths[0]) return state;
    const copied = copyAssetToUserData(result.filePaths[0], slotId);
    state = {
      ...state,
      assetSlots: state.assetSlots.map((slot) => slot.id === slotId ? {
        ...slot,
        ...copied,
        status: copied.validation.ok ? '已配置' : '需要修复',
        updatedAt: new Date().toISOString()
      } : slot)
    };
    addEvent('asset_replaced', `素材已替换：${slotId}`);
    broadcastState();
    return state;
  });

  ipcMain.handle('sprite:selectReference', async () => {
    const result = await dialog.showOpenDialog(panelWindow, {
      title: '选择角色参考图',
      properties: ['openFile'],
      filters: [
        { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    if (result.canceled || !result.filePaths[0]) return '';
    state = {
      ...state,
      petSpriteGenerator: {
        ...state.petSpriteGenerator,
        referencePath: result.filePaths[0],
        generationJobs: state.petSpriteGenerator?.currentRunDir ? readPetSpriteJobs(state.petSpriteGenerator.currentRunDir) : []
      }
    };
    broadcastState();
    return result.filePaths[0];
  });
  ipcMain.handle('sprite:structureActions', (_event, config) => structurePetSpriteActions(config));
  ipcMain.handle('sprite:createRun', (_event, config) => createPetSpriteRun(config));
  ipcMain.handle('sprite:autoGenerateRun', (_event, config) => autoGeneratePetSpriteRun(config));
  ipcMain.handle('sprite:markJob', (_event, config) => markPetSpriteJob(config));
  ipcMain.handle('sprite:importJobImage', (_event, config) => importPetSpriteJobImage(config));
  ipcMain.handle('sprite:repairJob', (_event, config) => createPetSpriteRepairPrompt(config));
  ipcMain.handle('sprite:processRun', (_event, runDir) => processPetSpriteRun(runDir));
  ipcMain.handle('sprite:refreshRun', (_event, runDir) => refreshPetSpriteRun(runDir));
  ipcMain.handle('sprite:openPath', (_event, kind, runDir) => openPetSpritePath(kind, runDir));
  ipcMain.handle('sprite:openJobPath', (_event, config) => openPetSpriteJobPath(config));
  ipcMain.handle('sprite:reviewRun', (_event, config) => reviewPetSpriteRun(config));
  ipcMain.handle('sprite:applyRun', (_event, runDir) => applyPetSpriteRun(runDir));

  ipcMain.handle('memory:confirm', (_event, index) => {
    const item = state.memories.candidate[index];
    if (!item) return state;
    snapshotCharacter('before_confirm_memory');
    state = {
      ...state,
      memories: {
        ...state.memories,
        confirmed: [item, ...state.memories.confirmed],
        candidate: state.memories.candidate.filter((_, i) => i !== index)
      }
    };
    broadcastState();
    return state;
  });
  ipcMain.handle('memory:delete', (_event, bucket, index) => {
    if (!state.memories[bucket]) return state;
    snapshotCharacter(`before_delete_${bucket}`);
    state = {
      ...state,
      memories: {
        ...state.memories,
        [bucket]: state.memories[bucket].filter((_, i) => i !== index)
      }
    };
    broadcastState();
    return state;
  });
  ipcMain.handle('memory:restoreVersion', (_event, index) => {
    const version = state.characterVersions[index];
    if (!version) return state;
    snapshotCharacter('before_restore_version');
    state = {
      ...state,
      character: version.character || state.character,
      memories: version.memories || state.memories
    };
    addEvent('character_version_restored', `已恢复 ${version.createdAt} 的角色版本`);
    broadcastState();
    return state;
  });

  ipcMain.handle('hooks:generate', () => generateHookScripts());
  ipcMain.handle('hooks:scanTargets', () => scanHookTargets());
  ipcMain.handle('hooks:generateSnippets', () => generateHookConfigSnippets());
  ipcMain.handle('hooks:installClaudeProject', () => installClaudeProjectHook());
  ipcMain.handle('hooks:uninstallClaudeProject', () => uninstallClaudeProjectHook());
  ipcMain.handle('hooks:installInstructions', () => generateHookInstallInstructions());
  ipcMain.handle('memo:add', (_event, text) => addMemo(text, null));
  ipcMain.handle('memo:addTimed', (_event, text, dueAt) => addMemo(text, dueAt));
  ipcMain.handle('memo:complete', (_event, id) => {
    state = { ...state, memos: state.memos.map((memo) => memo.id === id ? { ...memo, status: 'done' } : memo) };
    broadcastState();
    return state;
  });
  ipcMain.handle('pomodoro:start', () => startPomodoroSession());
  ipcMain.handle('pomodoro:complete', () => {
    state = {
      ...state,
      pomodoro: {
        ...state.pomodoro,
        status: 'completed',
        remainingSeconds: 0,
        completedToday: state.pomodoro.completedToday + 1
      }
    };
    state = applyEvent(state, buildEvent('pomodoro_completed', '已手动完成番茄钟。'));
    broadcastState();
    return state;
  });
  ipcMain.handle('pomodoro:pause', () => {
    state = {
      ...state,
      pomodoro: { ...state.pomodoro, status: 'focus_paused' },
      runtime: { ...state.runtime, status: '番茄钟已暂停', bubble: '专注已暂停。' }
    };
    broadcastState();
    return state;
  });
  ipcMain.handle('pomodoro:reset', () => {
    state = {
      ...state,
      pomodoro: {
        ...state.pomodoro,
        status: 'idle',
        startedAt: null,
        remainingSeconds: state.pomodoro.focusMinutes * 60
      },
      runtime: { ...state.runtime, status: '准备好了', animation: 'idle', bubble: '我准备好了，等你开始。' }
    };
    broadcastState();
    return state;
  });

  ipcMain.handle('deepseek:save', (_event, config) => {
    const nextConfig = {
      ...config,
      model: String(config?.model || '').trim() || defaultDeepSeekModel,
      endpoint: String(config?.endpoint || '').trim() || defaultDeepSeekEndpoint,
      apiKey: String(config?.apiKey || '').trim()
    };
    state = {
      ...state,
      deepSeek: { ...state.deepSeek, ...nextConfig, enabled: Boolean(nextConfig.apiKey), lastTest: null },
      preferences: { ...state.preferences, deepSeekKeyConfigured: Boolean(nextConfig.apiKey) }
    };
    broadcastState();
    return state;
  });
  ipcMain.handle('deepseek:test', async () => {
    if (!state.deepSeek.apiKey) {
      state = { ...state, deepSeek: { ...state.deepSeek, lastTest: '缺少接口密钥' } };
      broadcastState();
      return state;
    }
    try {
      const response = await fetch(state.deepSeek.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.deepSeek.apiKey}`
        },
        body: JSON.stringify(deepSeekRequestBody([
            { role: 'system', content: 'Return only JSON: {"bubble":"ok","status":"ok","emotion":"calm"}.' },
            { role: 'user', content: 'connection test' }
          ]))
      });
      state = { ...state, deepSeek: { ...state.deepSeek, lastTest: response.ok ? '连接正常' : `HTTP ${response.status}` } };
    } catch (error) {
      state = { ...state, deepSeek: { ...state.deepSeek, lastTest: `连接失败：${error.message}` } };
    }
    broadcastState();
    return state;
  });
  ipcMain.handle('agent:restart', () => restartAgentServer());
}

ipcMain.on('pet:beginDrag', () => {
  if (!petWindow) return;
  dragOrigin = { mouse: screen.getCursorScreenPoint(), bounds: petWindow.getBounds() };
});

ipcMain.on('pet:dragBy', () => {
  if (!dragOrigin || !petWindow) return;
  const point = screen.getCursorScreenPoint();
  petWindow.setPosition(
    dragOrigin.bounds.x + point.x - dragOrigin.mouse.x,
    dragOrigin.bounds.y + point.y - dragOrigin.mouse.y
  );
});

app.whenReady().then(() => {
  loadState();
  registerIpc();
  createPanelWindow();
  createPetWindow();
  createTray();
  startMemoTimer();
  startSystemStatusTimer();
  startWeatherTimer();
  startAgentServer();
  triggerEvent('app_started');
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  saveState();
});
