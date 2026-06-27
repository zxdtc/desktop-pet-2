import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell,
  Brain,
  Cat,
  Clock,
  CloudRain,
  Database,
  EyeOff,
  FileDown,
  FileUp,
  Gauge,
  ListChecks,
  Monitor,
  NotebookPen,
  PackageOpen,
  Play,
  Shield,
  Sparkles,
  StickyNote,
  Timer,
  Upload
} from 'lucide-react';
import { parseAndValidateSpriteActions } from '../shared/petSpriteActions.js';
import './PanelApp.css';

const text = {
  title: '\u684c\u5ba0 2.0',
  subtitle: '\u667a\u80fd\u60c5\u7eea\u684c\u9762\u5ba0\u7269\u5e73\u53f0',
  loading: '\u6b63\u5728\u542f\u52a8\u684c\u5ba0 2.0...',
  noBridge: '\u63a7\u5236\u9762\u677f\u5df2\u52a0\u8f7d\uff0c\u4f46\u4e3b\u7a0b\u5e8f\u63a5\u53e3\u672a\u6ce8\u5165\u3002\u8bf7\u91cd\u542f\u684c\u5ba0\u5e94\u7528\u3002',
  dashboard: '\u603b\u89c8',
  training: '\u89d2\u8272\u8bad\u7ec3',
  memory: '\u4eba\u683c\u4e0e\u8bb0\u5fc6',
  assets: '\u52a8\u4f5c\u7d20\u6750',
  pomodoro: '\u756a\u8304\u949f',
  memos: '\u5907\u5fd8\u5f55',
  events: '\u4e8b\u4ef6\u8054\u52a8',
  privacy: '\u9690\u79c1\u4e2d\u5fc3',
  settings: '\u6a21\u578b\u4e0e\u6027\u80fd',
  openPet: '\u663e\u793a\u684c\u5ba0',
  exportCharacter: '\u5bfc\u51fa\u89d2\u8272\u5305',
  quickControl: '\u5feb\u6377\u63a7\u5236',
  eventEffects: '\u4e8b\u4ef6\u89e6\u53d1\u6548\u679c',
  recentEvents: '\u6700\u8fd1\u4e8b\u4ef6',
  safeLog: '\u53ea\u8bb0\u5f55\u5b89\u5168\u6458\u8981\uff0c\u4e0d\u8bb0\u5f55\u952e\u76d8\u5185\u5bb9\u3001\u622a\u56fe\u6216\u804a\u5929\u6b63\u6587\u3002',
  assetLibrary: '\u52a8\u4f5c\u7d20\u6750\u5e93',
  assetHelp: '\u6bcf\u5f20\u5361\u7247\u5bf9\u5e94\u4e00\u4e2a\u684c\u5ba0\u4e8b\u4ef6\u6548\u679c\uff0c\u7528\u6237\u5728\u524d\u7aef\u586b\u5165\u5bf9\u5e94\u7d20\u6750\u3002',
  all: '\u5168\u90e8',
  configured: '\u5df2\u914d\u7f6e',
  optional: '\u53ef\u9009',
  required: '\u5fc5\u9700',
  replaceAsset: '\u66ff\u6362\u7d20\u6750',
  test: '\u6d4b\u8bd5',
  start: '\u5f00\u59cb',
  pause: '\u6682\u505c',
  reset: '\u91cd\u7f6e',
  complete: '\u5b8c\u6210',
  save: '\u4fdd\u5b58',
  importFile: '\u5bfc\u5165\u6587\u4ef6',
  acceptDraft: '\u786e\u8ba4\u5199\u5165\u89d2\u8272\u5305',
  empty: '\u6682\u65e0\u8bb0\u5f55',
  done: '\u5b8c\u6210',
  remember: '\u8bb0\u4e0b',
  refreshWeather: '\u5237\u65b0\u5929\u6c14'
};

const navItems = [
  ['dashboard', text.dashboard, Monitor],
  ['training', text.training, Brain],
  ['memory', text.memory, Database],
  ['assets', text.assets, PackageOpen],
  ['pomodoro', text.pomodoro, Timer],
  ['memos', text.memos, StickyNote],
  ['events', text.events, Bell],
  ['privacy', text.privacy, Shield],
  ['settings', text.settings, Gauge]
];

const defaultSpriteActions = [
  {
    id: 'idle',
    frame_count: 6,
    description: 'calm breathing, tiny blink, slight head bob',
    avoid: 'large gestures, walking, waving'
  },
  {
    id: 'happy',
    frame_count: 6,
    description: 'cheerful full-body reaction with a small bounce, same character identity',
    avoid: 'floating hearts, stars, text, confetti'
  },
  {
    id: 'sad',
    frame_count: 6,
    description: 'subtle sad pose, drooping body, small expression change, loopable',
    avoid: 'detached tears, symbols, dramatic collapse'
  }
];

const safe = (value, fallback = '-') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};

const visibleTextMap = {
  idle: '待机',
  focus_running: '专注中',
  focus_paused: '专注已暂停',
  break_running: '休息中',
  completed: '已完成',
  pending: '待处理',
  done: '已完成',
  due: '已到期',
  coding: '编程',
  office: '办公',
  browser: '浏览器',
  social: '社交',
  meeting: '会议',
  game: '游戏',
  video: '视频',
  other: '其他',
  'snippet-only': '仅生成片段',
  'safe-create-folder': '安全创建文件夹',
  config: '配置',
  'hooks-folder': '事件脚本文件夹',
  settings: '设置',
  'project-settings': '项目设置',
  project: '项目',
  installed: '已安装',
  removed: '已移除',
  passed: '通过',
  failed: '失败',
  warning: '有提醒',
  Running: '运行中',
  Restarting: '正在重启',
  Ready: '准备好了',
  Paused: '已暂停',
  'Pomodoro Focus': '番茄钟专注中',
  'Pomodoro Paused': '番茄钟已暂停',
  'Connection OK': '连接正常',
  'Missing API key': '缺少接口密钥',
  'Focus paused.': '专注已暂停。',
  'Ready when you are.': '我准备好了，等你开始。'
};

const displayText = (value, fallback = '-') => {
  const raw = safe(value, fallback);
  if (raw.startsWith('Found ') && raw.endsWith(' hook targets')) {
    return raw.replace(/^Found (\d+\/\d+) hook targets$/, '已发现 $1 个事件脚本配置位置');
  }
  if (raw.startsWith('Snippets generated in ')) return raw.replace('Snippets generated in ', '配置片段已生成：');
  if (raw.startsWith('Claude project hook installed: ')) return raw.replace('Claude project hook installed: ', 'Claude 项目事件脚本已安装：');
  if (raw.startsWith('Claude project hook removed: ')) return raw.replace('Claude project hook removed: ', 'Claude 项目事件脚本已移除：');
  if (raw.startsWith('Claude project settings not found: ')) return raw.replace('Claude project settings not found: ', '未找到 Claude 项目设置：');
  if (raw.startsWith('Failed: ')) return raw.replace('Failed: ', '失败：');
  return visibleTextMap[raw] || raw;
};

const eventTypeMap = {
  app_started: '应用启动',
  agent_task_completed: '智能体任务完成',
  agent_permission_waiting: '等待权限',
  agent_error: '智能体报错',
  work_focus_long: '久坐提醒',
  hydration_reminder: '喝水提醒',
  user_away_long: '长时间离开',
  user_returned: '用户回来',
  rainy_weather: '雨天陪伴',
  hot_weather: '高温提醒',
  cold_weather: '低温陪伴',
  video_attention: '视频求关注',
  pomodoro_started: '番茄钟开始',
  pomodoro_completed: '番茄钟完成',
  pomodoro_config_updated: '番茄钟配置更新',
  memo_created: '备忘录创建',
  memo_due: '备忘录到期',
  character_updated: '角色更新',
  character_version_restored: '角色版本恢复',
  training_file_imported: '训练材料导入',
  training_accepted: '训练写入',
  asset_replaced: '素材替换',
  weather_refreshed: '天气刷新',
  privacy_preference_updated: '隐私偏好更新',
  push_window_preview: '推窗口预告',
  push_window_executed: '推窗口执行',
  deepseek_decision: 'DeepSeek 决策',
  proactive_event_suppressed: '主动事件抑制',
  package_validation_failed: '包校验失败',
  character_package_imported: '角色包导入',
  assets_package_exported: '动作包导出',
  assets_package_imported: '动作包导入',
  character_package_exported: '角色包导出',
  hook_scripts_generated: '事件脚本生成',
  hook_targets_scanned: '配置位置扫描',
  hook_config_snippets_generated: '配置片段生成',
  claude_project_hook_installed: 'Claude 项目脚本安装',
  claude_project_hook_removed: 'Claude 项目脚本移除',
  hook_install_instructions_generated: '安装说明生成'
};

const displayEventType = (type) => eventTypeMap[type] || displayText(type);

function callApi(name, ...args) {
  const api = window.desktopPet;
  if (!api || typeof api[name] !== 'function') return Promise.resolve(null);
  return api[name](...args);
}

function decodeEscapedVisibleText(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (node.nodeValue.includes('\\u')) {
      node.nodeValue = node.nodeValue.replace(/\\u([0-9a-fA-F]{4})/g, (_match, code) => (
        String.fromCharCode(parseInt(code, 16))
      ));
    }
  }
}

function useDesktopPetState() {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!window.desktopPet) {
      setError(text.noBridge);
      return undefined;
    }
    let alive = true;
    window.desktopPet.getState()
      .then((next) => {
        if (alive) setState(next);
      })
      .catch((reason) => {
        if (alive) setError(String(reason?.message || reason));
      });
    return window.desktopPet.onState((next) => {
      if (alive) setState(next);
    });
  }, []);

  return { state, error };
}

function StatCard({ icon: Icon, label, value, tone = 'blue' }) {
  return (
    <section className={`stat-card ${tone}`}>
      <Icon size={20} />
      <div>
        <span>{label}</span>
        <strong>{displayText(value)}</strong>
      </div>
    </section>
  );
}

function Toggle({ label, value, onChange, hint }) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
      <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function NumberPreference({ label, value, unit, preferenceKey, min = 1, hint }) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
      <input
        className="number-input"
        type="number"
        min={min}
        value={value ?? min}
        onChange={(event) => callApi('setPreference', preferenceKey, Number(event.target.value))}
        aria-label={`${label}${unit ? ` ${unit}` : ''}`}
      />
    </label>
  );
}

function SectionTitle({ title, children }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

function EventButton({ type, label }) {
  return (
    <button className="secondary" onClick={() => callApi('triggerEvent', type)}>
      <Play size={16} /> {label}
    </button>
  );
}

function Dashboard({ state }) {
  const slots = state.assetSlots || [];
  const configured = slots.filter((slot) => slot.assetUrl || slot.status === '\u5df2\u914d\u7f6e').length;
  const missingRequired = slots.filter((slot) => slot.required && !slot.assetUrl && slot.status !== '\u5df2\u914d\u7f6e').length;

  return (
    <div className="page-grid">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">桌宠 2.0 预览版</p>
          <h1>{safe(state.character?.displayName, text.title)}</h1>
          <p>{safe(state.character?.persona, '\u4f4e\u6253\u6270\u3001\u60c5\u7eea\u5316\u53cd\u9988\u3001\u53ef\u5b9a\u5236\u7684\u684c\u9762\u5ba0\u7269\u3002')}</p>
        </div>
        <div className="event-buttons">
          <button className="primary" onClick={() => callApi('showPet')}><Cat size={18} /> {text.openPet}</button>
          <button className="secondary" onClick={() => callApi('exportCharacterPackage')}><FileDown size={18} /> {text.exportCharacter}</button>
        </div>
      </div>

      <div className="stats-row">
        <StatCard icon={Sparkles} label="\u5f53\u524d\u72b6\u6001" value={state.runtime?.status} />
        <StatCard icon={EyeOff} label="迷你模式" value={state.preferences?.miniMode ? '\u5f00\u542f' : '\u5173\u95ed'} tone="amber" />
        <StatCard icon={Shield} label="\u514d\u6253\u6270" value={state.preferences?.dnd ? '\u5f00\u542f' : '\u5173\u95ed'} tone="slate" />
        <StatCard icon={PackageOpen} label="\u7d20\u6750\u914d\u7f6e" value={`${configured}/${slots.length}`} tone={missingRequired ? 'rose' : 'blue'} />
      </div>

      <section className="panel-card">
        <SectionTitle title={text.quickControl}>
          贴边迷你模式、免打扰、调皮互动和视频场景推窗口都可以在这里直接控制。
        </SectionTitle>
        <div className="quick-grid">
          <Toggle label="贴边迷你模式" value={state.preferences?.miniMode} onChange={(value) => callApi('setPreference', 'miniMode', value)} hint="\u4f4e\u6253\u6270\uff0c\u53ea\u5728\u5c4f\u5e55\u8fb9\u7f18\u63a2\u5934" />
          <Toggle label="\u514d\u6253\u6270" value={state.preferences?.dnd} onChange={(value) => callApi('setPreference', 'dnd', value)} hint="\u4ec5\u4fdd\u7559\u9ad8\u4f18\u5148\u7ea7\u63d0\u9192" />
          <Toggle label="\u8c03\u76ae\u4e92\u52a8" value={state.preferences?.playfulEnabled} onChange={(value) => callApi('setPreference', 'playfulEnabled', value)} hint="允许桌面鹅式互动" />
          <Toggle label="\u89c6\u9891\u6c42\u5173\u6ce8\u63a8\u7a97\u53e3" value={state.preferences?.pushWindowEnabled} onChange={(value) => callApi('setPreference', 'pushWindowEnabled', value)} hint="\u7528\u6237\u663e\u5f0f\u5f00\u542f\u540e\u624d\u89e6\u53d1" />
        </div>
        <div className="inline-settings">
          <label>
            迷你模式贴边方向
            <select value={state.preferences?.miniEdge || 'right'} onChange={(event) => callApi('setMiniEdge', event.target.value)}>
              <option value="right">\u53f3\u4fa7</option>
              <option value="left">\u5de6\u4fa7</option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel-card">
        <SectionTitle title="\u4e3b\u52a8\u89e6\u53d1\u7b56\u7565">
          \u684c\u5ba0\u4f1a\u628a\u4f4e\u98ce\u9669\u72b6\u6001\u6458\u8981\u8f6c\u6210\u60c5\u7eea\u5316\u53cd\u9988\uff1a\u4e45\u5750\u3001\u559d\u6c34\u3001\u79bb\u5f00\u3001\u56de\u6765\u548c\u89c6\u9891\u6c42\u5173\u6ce8\u3002
        </SectionTitle>
        <div className="quick-grid">
          <Toggle label="\u542f\u7528\u4e3b\u52a8\u89e6\u53d1" value={state.preferences?.proactiveEnabled} onChange={(value) => callApi('setPreference', 'proactiveEnabled', value)} hint="\u514d\u6253\u6270\u6216\u6682\u505c\u65f6\u4e0d\u4e3b\u52a8\u6253\u6270" />
          <Toggle label="DeepSeek 决策主动事件" value={state.preferences?.aiProactiveDecision} onChange={(value) => callApi('setPreference', 'aiProactiveDecision', value)} hint="配置接口密钥后，本地只提供候选，由模型决定是否触发" />
          <NumberPreference label="\u4e45\u5750\u63d0\u9192" unit="\u5206\u949f" preferenceKey="workFocusReminderMinutes" value={state.preferences?.workFocusReminderMinutes} hint="\u8fde\u7eed\u5de5\u4f5c\u8d85\u8fc7\u8fd9\u4e2a\u65f6\u95f4\u540e\u89e6\u53d1" />
          <NumberPreference label="\u559d\u6c34\u95f4\u9694" unit="\u5206\u949f" preferenceKey="hydrationReminderMinutes" value={state.preferences?.hydrationReminderMinutes} hint="\u4ec5\u5728\u6d3b\u8dc3\u5de5\u4f5c\u65f6\u8ba1\u65f6" />
          <NumberPreference label="\u957f\u65f6\u95f4\u79bb\u5f00" unit="\u79d2" preferenceKey="awayLongSeconds" value={state.preferences?.awayLongSeconds} hint="\u7a7a\u95f2\u8d85\u8fc7\u9608\u503c\u540e\u684c\u5ba0\u8fdb\u5165\u7b49\u5f85\u72b6\u6001" />
          <NumberPreference label="\u89c6\u9891\u6c42\u5173\u6ce8" unit="\u79d2" preferenceKey="videoAttentionIdleSeconds" value={state.preferences?.videoAttentionIdleSeconds} hint="\u524d\u53f0\u662f\u89c6\u9891\u4e14\u957f\u65f6\u95f4\u65e0\u4e92\u52a8\u65f6\u89e6\u53d1" />
          <NumberPreference label="\u4e3b\u52a8\u89e6\u53d1\u51b7\u5374" unit="\u5206\u949f" preferenceKey="proactiveCooldownMinutes" value={state.preferences?.proactiveCooldownMinutes} hint="\u9632\u6b62\u684c\u5ba0\u9891\u7e41\u6253\u6270" />
        </div>
      </section>

      <section className="panel-card">
        <SectionTitle title={text.eventEffects}>
          \u5148\u7528\u6a21\u62df\u4e8b\u4ef6\u9a8c\u8bc1\u684c\u5ba0\u7684\u60c5\u7eea\u53cd\u9988\u548c\u52a8\u4f5c\u7d20\u6750\u8054\u52a8\u3002
        </SectionTitle>
        <div className="event-buttons">
          <EventButton type="agent_task_completed" label="智能体完成" />
          <EventButton type="agent_permission_waiting" label="\u7b49\u5f85\u6743\u9650" />
          <EventButton type="agent_error" label="智能体报错" />
          <EventButton type="work_focus_long" label="\u4e45\u5750\u63d0\u9192" />
          <EventButton type="rainy_weather" label="\u4e0b\u96e8\u966a\u4f34" />
          <EventButton type="video_attention" label="\u89c6\u9891\u6c42\u5173\u6ce8" />
        </div>
      </section>

      <SystemAndWeather state={state} />
      <EventPanel title={text.recentEvents} events={(state.events || []).slice(0, 6)} />
    </div>
  );
}

function SystemAndWeather({ state }) {
  return (
    <section className="panel-card">
      <SectionTitle title="\u72b6\u6001\u76d1\u63a7">
        \u53ea\u8bfb\u53d6\u4f4e\u98ce\u9669\u6458\u8981\uff1a\u7a7a\u95f2\u65f6\u957f\u3001\u524d\u53f0\u5e94\u7528\u5206\u7c7b\u3001\u5185\u5b58\u3001\u7535\u6e90\u548c\u5929\u6c14\u3002
      </SectionTitle>
      <div className="stats-row">
        <StatCard icon={Clock} label="\u7a7a\u95f2\u65f6\u957f" value={`${safe(state.systemStatus?.idleSeconds, 0)}s`} />
        <StatCard icon={Gauge} label="\u7cfb\u7edf\u5185\u5b58" value={`${safe(state.systemStatus?.memoryMb, 0)} MB`} tone="amber" />
        <StatCard icon={Monitor} label="\u672c\u8fdb\u7a0b\u5185\u5b58" value={`${safe(state.systemStatus?.processMemoryMb, 0)} MB`} tone="slate" />
        <StatCard icon={CloudRain} label="\u7535\u6e90\u72b6\u6001" value={state.systemStatus?.battery} />
      </div>
      <div className="foreground-card">
        <strong>\u524d\u53f0\u5e94\u7528\u5206\u7c7b\uff1a{displayText(state.systemStatus?.foregroundCategory, '\u672a\u68c0\u6d4b')}</strong>
        <span>\u8fdb\u7a0b\uff1a{safe(state.systemStatus?.foregroundProcess, '\u672a\u8bb0\u5f55')}</span>
        <span>\u6807\u9898\u6458\u8981\uff1a{safe(state.systemStatus?.foregroundTitleSafe, '\u672a\u8bb0\u5f55')}</span>
      </div>
      <div className="agent-card">
        <div>
          <strong>{displayText(state.weather?.status, '\u672a\u5237\u65b0')}</strong>
          <p>{safe(state.weather?.location, '\u672a\u83b7\u53d6\u4f4d\u7f6e')} {state.weather?.temperature ? ` / ${state.weather.temperature}` : ''} {state.weather?.summary ? ` / ${state.weather.summary}` : ''}</p>
        </div>
        <button className="secondary" onClick={() => callApi('refreshWeather')}>{text.refreshWeather}</button>
      </div>
    </section>
  );
}

function Training({ state }) {
  const [body, setBody] = useState('');
  const [sourceType, setSourceType] = useState('skill.md');
  const [profile, setProfile] = useState(() => ({
    displayName: state.character?.displayName || '',
    persona: state.character?.persona || '',
    voiceStyle: state.character?.voiceStyle || '',
    relationshipStyle: state.character?.relationshipStyle || ''
  }));
  const draft = state.trainingDraft;

  useEffect(() => {
    setProfile({
      displayName: state.character?.displayName || '',
      persona: state.character?.persona || '',
      voiceStyle: state.character?.voiceStyle || '',
      relationshipStyle: state.character?.relationshipStyle || ''
    });
  }, [state.character?.displayName, state.character?.persona, state.character?.voiceStyle, state.character?.relationshipStyle]);

  return (
    <div className="page-grid">
      <section className="panel-card">
        <SectionTitle title="\u89d2\u8272\u8d44\u6599\u76f4\u63a5\u7f16\u8f91">
          \u8fd9\u91cc\u7528\u4e8e\u5feb\u901f\u5b9a\u5236\u684c\u5ba0\u540d\u5b57\u3001\u4eba\u8bbe\u3001\u8bed\u6c14\u548c\u5173\u7cfb\u611f\uff1b\u66f4\u590d\u6742\u7684\u98ce\u683c\u5219\u7528\u4e0b\u65b9\u6750\u6599\u8bad\u7ec3\u3002
        </SectionTitle>
        <div className="form-stack">
          <label>
            \u540d\u5b57
            <input value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} />
          </label>
          <label>
            \u4eba\u8bbe
            <textarea className="compact-textarea" value={profile.persona} onChange={(event) => setProfile({ ...profile, persona: event.target.value })} />
          </label>
          <label>
            \u8bed\u6c14
            <textarea className="compact-textarea" value={profile.voiceStyle} onChange={(event) => setProfile({ ...profile, voiceStyle: event.target.value })} />
          </label>
          <label>
            \u5173\u7cfb\u611f
            <textarea className="compact-textarea" value={profile.relationshipStyle} onChange={(event) => setProfile({ ...profile, relationshipStyle: event.target.value })} />
          </label>
          <div className="event-buttons">
            <button className="primary" onClick={() => callApi('updateCharacter', profile)}>{text.save}</button>
          </div>
        </div>
      </section>
      <section className="panel-card">
        <SectionTitle title="\u6750\u6599\u5bfc\u5165\u4e0e\u8bad\u7ec3">
          \u9ed8\u8ba4\u7528\u6750\u6599\u8bad\u7ec3\u539f\u521b\u5ba0\u7269\u6027\u683c\uff1b\u5982\u679c\u8981\u63a5\u8fd1\u67d0\u4e2a\u4eba\u7684\u8bf4\u8bdd\u65b9\u5f0f\uff0c\u9700\u8981\u63d0\u4f9b\u804a\u5929\u8bb0\u5f55\u6216 skill.md \u5e76\u8fdb\u5165\u98ce\u683c\u5ba1\u6838\u3002
        </SectionTitle>
        <div className="training-layout">
          <div className="form-stack">
            <label>
              \u6750\u6599\u7c7b\u578b
              <select value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
                <option value="skill.md">skill.md</option>
                <option value="persona.md">persona.md</option>
                <option value="memories.md">memories.md</option>
                <option value="chat-record">\u804a\u5929\u8bb0\u5f55</option>
                <option value="plain-text">\u666e\u901a\u6587\u672c</option>
              </select>
            </label>
            <label>
              \u7c98\u8d34\u6750\u6599
              <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="\u4f8b\u5982\uff1a\u5b83\u6e29\u67d4\u3001\u4f4e\u6253\u6270\uff0c\u559c\u6b22\u7528\u77ed\u53e5\u966a\u6211\u5de5\u4f5c..." />
            </label>
            <div className="event-buttons">
              <button className="primary" onClick={() => callApi('createTrainingDraft', body, sourceType)}><Upload size={18} /> \u751f\u6210\u8bad\u7ec3\u9884\u89c8</button>
              <button className="secondary" onClick={() => callApi('importTrainingFile')}><FileUp size={18} /> {text.importFile}</button>
              <button className="secondary" onClick={() => callApi('importCharacterPackage')}><PackageOpen size={18} /> \u5bfc\u5165\u89d2\u8272\u5305</button>
            </div>
          </div>
          <div className={`draft-card ${draft ? '' : 'empty'}`}>
            {!draft ? (
              <>
                <Brain size={34} />
                <h3>\u7b49\u5f85\u751f\u6210\u9884\u89c8</h3>
                <p>\u5bfc\u5165\u6750\u6599\u540e\uff0c\u8fd9\u91cc\u4f1a\u663e\u793a\u4eba\u683c\u3001\u8bed\u6c14\u3001\u8bb0\u5fc6\u5019\u9009\u548c\u98ce\u9669\u63d0\u793a\u3002</p>
              </>
            ) : (
              <>
                <p className="eyebrow">{draft.mode === 'real_person_style_review' ? '\u771f\u4eba\u98ce\u683c\u5ba1\u6838' : '\u539f\u521b\u5ba0\u7269\u4eba\u683c'}</p>
                <h3>\u8bad\u7ec3\u8349\u7a3f</h3>
                <dl>
                  <dt>\u4eba\u683c</dt><dd>{safe(draft.persona)}</dd>
                  <dt>\u8bed\u6c14</dt><dd>{safe(draft.voiceStyle)}</dd>
                  <dt>\u5019\u9009\u8bb0\u5fc6</dt><dd>{(draft.memories || []).join('\uff1b')}</dd>
                  <dt>\u98ce\u9669\u63d0\u793a</dt><dd>{(draft.risks || []).join('\uff1b')}</dd>
                </dl>
                <button className="primary" onClick={() => callApi('acceptTrainingDraft')}>{text.acceptDraft}</button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Memory({ state }) {
  const memories = state.memories || {};
  const relationship = memories.relationship || {};
  const preferences = memories.preferences || [];
  const recentInsights = memories.recentInsights || [];
  const eventCounts = memories.signals?.eventCounts || {};
  const topEvents = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  return (
    <div className="page-grid">
      <section className="panel-card">
        <SectionTitle title="记忆中心">
          本地只保存安全摘要和偏好信号，用来让桌宠逐渐理解你的习惯、打扰边界和互动偏好。
        </SectionTitle>
        <div className="memory-metrics">
          <MemoryMetric label="亲密度" value={relationship.affinity ?? 0} />
          <MemoryMetric label="安静默契" value={relationship.quietTrust ?? 0} />
          <MemoryMetric label="调皮度" value={relationship.playfulness ?? 0} />
          <MemoryMetric label="照顾需求" value={relationship.careNeed ?? 0} />
        </div>
      </section>

      <div className="two-columns">
        <section className="panel-card">
          <h2>偏好信号</h2>
          <ul className="clean-list">
            {(preferences.length ? preferences : [{ label: text.empty, confidence: 0 }]).map((item, index) => (
              <li key={item.id || `preference_${index}`} className="memory-item preference-item">
                <span>
                  <strong>{safe(item.label)}</strong>
                  <small>置信度 {Number(item.confidence || 0)} / 100 · 证据 {Number(item.evidenceCount || 0)} 次</small>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel-card">
          <h2>最近洞察</h2>
          <ul className="event-list compact">
            {(recentInsights.length ? recentInsights : [{ summary: text.empty }]).map((item, index) => (
              <li key={item.id || `insight_${index}`}>
                <span>{safe(item.summary)}</span>
                <p>{item.type ? `${displayEventType(item.type)} · 证据 ${item.evidenceCount || 1} 次` : ''}</p>
                <time>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</time>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="three-columns">
        <MemoryColumn title="\u5df2\u786e\u8ba4\u8bb0\u5fc6" bucket="confirmed" items={state.memories?.confirmed || []} />
        <MemoryColumn title="\u5019\u9009\u8bb0\u5fc6" bucket="candidate" items={state.memories?.candidate || []} confirmable />
        <MemoryColumn title="\u654f\u611f\u5f85\u786e\u8ba4" bucket="sensitivePending" items={state.memories?.sensitivePending || []} />
      </div>
      <section className="panel-card">
        <SectionTitle title="事件信号">
          这些是桌宠用来判断习惯的安全计数，不包含键盘内容、截图或聊天正文。
        </SectionTitle>
        <div className="event-chip-grid">
          {(topEvents.length ? topEvents : [[text.empty, 0]]).map(([type, count]) => (
            <span key={type} className="event-chip">{displayEventType(type)} · {count}</span>
          ))}
        </div>
      </section>
      <section className="panel-card">
        <SectionTitle title="\u89d2\u8272\u7248\u672c">
          \u8bad\u7ec3\u548c\u8bb0\u5fc6\u64cd\u4f5c\u524d\u4f1a\u7559\u4e0b\u5feb\u7167\uff0c\u4fbf\u4e8e\u6062\u590d\u5230\u65e7\u7248\u672c\u3002
        </SectionTitle>
        <VersionList versions={state.characterVersions || []} />
      </section>
    </div>
  );
}

function MemoryMetric({ label, value }) {
  const percent = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="memory-metric">
      <span>{label}</span>
      <strong>{percent}</strong>
      <div><i style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

function VersionList({ versions }) {
  if (!versions.length) return <p>{text.empty}</p>;
  return (
    <ul className="event-list">
      {versions.map((version, index) => (
        <li key={`${version.createdAt || 'version'}_${index}`}>
          <span>{safe(version.reason, '\u89d2\u8272\u5feb\u7167')}</span>
          <p>{safe(version.character?.displayName, '\u89d2\u8272')} / {safe(version.createdAt)}</p>
          <time>{version.createdAt ? new Date(version.createdAt).toLocaleString() : ''}</time>
          <button className="inline-action" onClick={() => callApi('restoreCharacterVersion', index)}>\u6062\u590d\u8fd9\u4e2a\u7248\u672c</button>
        </li>
      ))}
    </ul>
  );
}

function MemoryColumn({ title, bucket, items, confirmable }) {
  return (
    <section className="panel-card">
      <h2>{title}</h2>
      <ul className="clean-list">
        {(items.length ? items : [text.empty]).map((item, index) => (
          <li key={`${bucket}_${index}`} className="memory-item">
            <span>{item}</span>
            {items.length ? (
              <div>
                {confirmable ? <button onClick={() => callApi('confirmMemory', index)}>\u786e\u8ba4</button> : null}
                <button onClick={() => callApi('deleteMemory', bucket, index)}>\u5220\u9664</button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SpriteGenerator({ state }) {
  const generator = state.petSpriteGenerator || {};
  const [referencePath, setReferencePath] = useState(generator.referencePath || '');
  const [petName, setPetName] = useState(state.character?.displayName || '小团子');
  const [styleNotes, setStyleNotes] = useState('保持参考图的角色身份，适合桌宠小尺寸显示。');
  const [chromaKey, setChromaKey] = useState('#0000FF');
  const [actionsText, setActionsText] = useState(JSON.stringify(defaultSpriteActions, null, 2));
  const [naturalLanguageActions, setNaturalLanguageActions] = useState('');
  const [structuringActions, setStructuringActions] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [generateSpritesheet, setGenerateSpritesheet] = useState(true);
  const [markJobId, setMarkJobId] = useState('canonical-base');
  const [markStatus, setMarkStatus] = useState('generated');
  const [markSourcePath, setMarkSourcePath] = useState('');
  const [markQaNote, setMarkQaNote] = useState('');
  const [message, setMessage] = useState('');
  const [canonicalChecks, setCanonicalChecks] = useState({
    fullBodyVisible: false,
    identityMatches: false,
    flatChromaBackground: false,
    readableAtCellSize: false
  });
  const [actionChecks, setActionChecks] = useState({});
  const generationJobs = generator.generationJobs || [];
  const validationSummary = generator.validationSummary || null;
  const previewMedia = generator.previewMedia || {};
  const actionsValidation = useMemo(() => parseAndValidateSpriteActions(actionsText), [actionsText]);
  const visualReviewActions = useMemo(() => {
    const byId = new Map(actionsValidation.actions.map((action) => [action.id, action]));
    for (const action of validationSummary?.actions || []) {
      if (!byId.has(action.id)) byId.set(action.id, { id: action.id, description: '', avoid: '' });
    }
    return Array.from(byId.values());
  }, [actionsValidation.actions, validationSummary?.actions]);
  const canonicalChecksPassed = Object.values(canonicalChecks).every(Boolean);
  const actionChecksPassed = visualReviewActions.length > 0 && visualReviewActions.every((action) => {
    const checks = actionChecks[action.id] || {};
    return checks.identityStable
      && checks.actionMatches
      && checks.avoidRespected
      && checks.fullCharacterVisible
      && checks.noBannedElements
      && checks.loopReadable;
  });
  const visualChecksPassed = canonicalChecksPassed && actionChecksPassed;
  const canApplySprite = Boolean(validationSummary?.runSummary?.readyForUse);
  const applyDisabledReason = canApplySprite
    ? '已通过自动检查和视觉 QA，可以应用。'
    : (validationSummary?.runSummary?.readyReason || '需要先完成处理、自动检查和视觉 QA。');

  useEffect(() => {
    if (generator.referencePath) setReferencePath(generator.referencePath);
  }, [generator.referencePath]);

  const structureActions = async () => {
    try {
      setStructuringActions(true);
      const result = await callApi('structureSpriteActions', {
        petName,
        styleNotes,
        chromaKey,
        naturalLanguage: naturalLanguageActions
      });
      const nextActionsText = JSON.stringify(result.actions || [], null, 2);
      const validation = parseAndValidateSpriteActions(nextActionsText);
      if (!validation.ok) {
        setMessage(`智能整理结果不可用：${validation.errors[0]}`);
        return;
      }
      setPetName(result.pet_name || petName);
      setStyleNotes(result.style_notes || styleNotes);
      setChromaKey(result.chroma_key || chromaKey);
      setActionsText(nextActionsText);
      setMessage(`已整理 ${validation.actions.length} 个动作，请确认后再创建运行目录。`);
    } catch (error) {
      setMessage(`智能整理动作结构失败：${error.message || error}`);
    } finally {
      setStructuringActions(false);
    }
  };

  const createRun = async () => {
    try {
      if (!actionsValidation.ok) {
        setMessage(`动作配置有问题：${actionsValidation.errors[0]}`);
        return;
      }
      const result = await callApi('createSpriteRun', {
        referencePath,
        petName,
        styleNotes,
        chromaKey,
        actions: actionsValidation.actions
      });
      setMessage(result?.runDir ? `已创建：${result.runDir}` : '已创建运行目录');
    } catch (error) {
      setMessage(`创建失败：${error.message || error}`);
    }
  };

  const autoGenerateRun = async () => {
    try {
      if (!actionsValidation.ok) {
        setMessage(`动作配置有问题：${actionsValidation.errors[0]}`);
        return;
      }
      setAutoGenerating(true);
      const result = await callApi('autoGenerateSpriteRun', {
        referencePath,
        petName,
        styleNotes,
        chromaKey,
        actions: actionsValidation.actions,
        generateSpritesheet
      });
      const previewCount = result?.processed?.actions?.length || result?.generated?.actions?.length || 0;
      setMessage(`已从参考图自动生成 ${previewCount} 个动作 GIF，请检查下方预览和 QA。`);
    } catch (error) {
      setMessage(`自动生成失败：${error.message || error}`);
    } finally {
      setAutoGenerating(false);
    }
  };

  const processRun = async () => {
    try {
      const result = await callApi('processSpriteRun', {
        runDir: generator.currentRunDir,
        generateSpritesheet
      });
      setMessage(result?.ok
        ? (generateSpritesheet ? '处理完成，已生成动作帧、GIF 预览、QA 和桌宠图集。' : '处理完成，已生成动作帧、GIF 预览和 QA。')
        : '处理完成，但有动作需要修复。');
    } catch (error) {
      setMessage(`处理失败：${error.message || error}`);
    }
  };

  const markJob = async () => {
    try {
      const result = await callApi('markSpriteJob', {
        runDir: generator.currentRunDir,
        jobId: markJobId,
        status: markStatus,
        sourcePath: markSourcePath,
        qaNote: markQaNote
      });
      setMessage(result?.job ? `已登记：${result.job.id} -> ${result.job.status}` : '已登记生成状态');
    } catch (error) {
      setMessage(`登记失败：${error.message || error}`);
    }
  };

  const importJobImage = async () => {
    try {
      const result = await callApi('importSpriteJobImage', {
        runDir: generator.currentRunDir,
        jobId: markJobId,
        qaNote: markQaNote
      });
      if (result?.decoded_path) {
        setMarkSourcePath(result.decoded_path);
        setMessage(`已导入到 decoded：${result.decoded_path}`);
      }
    } catch (error) {
      setMessage(`导入失败：${error.message || error}`);
    }
  };

  const repairJob = async () => {
    try {
      const result = await callApi('repairSpriteJob', {
        runDir: generator.currentRunDir,
        jobId: markJobId,
        reason: markQaNote
      });
      setMessage(result?.repair_prompt_path ? `已生成修复提示词：${result.repair_prompt_path}` : '已生成修复提示词');
    } catch (error) {
      setMessage(`生成修复提示词失败：${error.message || error}`);
    }
  };

  const refreshRun = async () => {
    try {
      await callApi('refreshSpriteRun', generator.currentRunDir);
      setMessage('已刷新运行状态和预览。');
    } catch (error) {
      setMessage(`刷新失败：${error.message || error}`);
    }
  };

  const openSpritePath = async (kind) => {
    try {
      const result = await callApi('openSpritePath', kind, generator.currentRunDir);
      setMessage(result?.path ? `已打开：${result.path}` : '已打开。');
    } catch (error) {
      setMessage(`打开失败：${error.message || error}`);
    }
  };

  const openJobPath = async (jobId, field) => {
    try {
      const result = await callApi('openSpriteJobPath', {
        runDir: generator.currentRunDir,
        jobId,
        field
      });
      setMessage(result?.path ? `已打开：${result.path}` : '已打开。');
    } catch (error) {
      setMessage(`打开任务文件失败：${error.message || error}`);
    }
  };

  const setCanonicalCheck = (key, value) => {
    setCanonicalChecks((current) => ({ ...current, [key]: value }));
  };

  const setActionCheck = (actionId, key, value) => {
    setActionChecks((current) => ({
      ...current,
      [actionId]: {
        ...(current[actionId] || {}),
        [key]: value
      }
    }));
  };

  const buildVisualChecklist = (status, failedJobs = []) => {
    const accepted = status === 'accepted';
    const failedSet = new Set(failedJobs);
    return {
      source: 'control-panel',
      confirmedAt: new Date().toISOString(),
      canonical_base: {
        full_body_visible: accepted && canonicalChecks.fullBodyVisible,
        identity_matches_reference: accepted && canonicalChecks.identityMatches,
        flat_chroma_background: accepted && canonicalChecks.flatChromaBackground,
        readable_at_cell_size: accepted && canonicalChecks.readableAtCellSize
      },
      actions: visualReviewActions.map((action) => {
        const failed = failedSet.has(action.id);
        const checks = actionChecks[action.id] || {};
        return {
          id: action.id,
          identity_stable: accepted && checks.identityStable && !failed,
          action_matches_description: accepted && checks.actionMatches && !failed,
          avoid_list_respected: accepted && checks.avoidRespected && !failed,
          full_character_visible: accepted && checks.fullCharacterVisible && !failed,
          no_banned_elements: accepted && checks.noBannedElements && !failed,
          loop_readable: accepted && checks.loopReadable && !failed,
          description: action.description,
          avoid: action.avoid || 'none'
        };
      })
    };
  };

  const reviewRun = async (status) => {
    try {
      if (status === 'accepted' && validationSummary?.exists && !validationSummary.ok) {
        setMessage('自动检查还有错误，不能标记视觉 QA 通过。请先修复尺寸、帧数或透明背景问题。');
        return;
      }
      if (status === 'accepted' && !visualChecksPassed) {
        setMessage('请先完成 canonical-base 和每个动作的视觉 QA 勾选，再标记视觉 QA 通过。');
        return;
      }
      const failedJobs = status === 'failed' && markJobId ? [markJobId] : [];
      const result = await callApi('reviewSpriteRun', {
        runDir: generator.currentRunDir,
        status,
        note: markQaNote,
        failedJobs,
        checklist: buildVisualChecklist(status, failedJobs)
      });
      setMessage(status === 'accepted'
        ? `视觉 QA 已通过：${result?.reviewed_at || ''}`
        : `已记录视觉 QA 未通过：${failedJobs.join('、') || '未指定动作'}`);
    } catch (error) {
      setMessage(`记录视觉 QA 失败：${error.message || error}`);
    }
  };

  const applyRun = async () => {
    if (!canApplySprite) {
      setMessage(`暂不能应用：${applyDisabledReason}`);
      return;
    }
    try {
      const result = await callApi('applySpriteRun', generator.currentRunDir);
      setMessage(result?.spritesheetPath ? `已应用到桌宠形象：${result.spritesheetPath}` : '已应用到桌宠形象。');
    } catch (error) {
      setMessage(`应用失败：${error.message || error}`);
    }
  };

  return (
    <section className="panel-card">
      <SectionTitle title="角色动作生成">
        给定角色参考图，为 N 个动作生成横向动作条；生成图放入 decoded 后，可一键切帧、抠背景、输出动作帧和 QA，必要时额外拼 spritesheet。
      </SectionTitle>
      <div className="sprite-generator">
        <div className="form-stack">
          <label>
            参考图
            <div className="path-picker">
              <input value={referencePath} onChange={(event) => setReferencePath(event.target.value)} placeholder="选择或粘贴 reference_image 路径" />
              <button className="secondary" onClick={async () => {
                const selected = await callApi('selectSpriteReference');
                if (selected) setReferencePath(selected);
              }}>选择</button>
            </div>
          </label>
          <label>
            桌宠名称
            <input value={petName} onChange={(event) => setPetName(event.target.value)} />
          </label>
          <label>
            风格说明
            <textarea className="compact-textarea" value={styleNotes} onChange={(event) => setStyleNotes(event.target.value)} />
          </label>
          <label>
            Chroma Key
            <select value={chromaKey} onChange={(event) => setChromaKey(event.target.value)}>
              <option value="#0000FF">#0000FF 蓝底</option>
              <option value="#00FF00">#00FF00 绿底</option>
            </select>
          </label>
          <label>
            动作需求描述
            <textarea
              className="compact-textarea"
              value={naturalLanguageActions}
              onChange={(event) => setNaturalLanguageActions(event.target.value)}
              placeholder="例如：我要边牧，有待机、开心、难过三个动作，每个 6 帧。动作只用身体姿态表达，不要文字、符号和特效。"
            />
          </label>
          <button className="secondary" onClick={structureActions} disabled={structuringActions || !naturalLanguageActions.trim()}>
            {structuringActions ? '正在整理...' : '智能整理动作结构'}
          </button>
        </div>
        <div className="form-stack">
          <label>
            动作列表 JSON
            <textarea value={actionsText} onChange={(event) => setActionsText(event.target.value)} />
          </label>
          {actionsValidation.errors.length ? (
            <div className="validation-bad action-validation">
              {actionsValidation.errors.map((error) => <p key={error}>{error}</p>)}
            </div>
          ) : (
            <div className="validation-ok action-validation">动作配置可用。</div>
          )}
          <label className="inline-check">
            <input type="checkbox" checked={generateSpritesheet} onChange={(event) => setGenerateSpritesheet(event.target.checked)} />
            同时生成桌宠图集 spritesheet.webp
          </label>
          <div className="event-buttons">
            <button className="primary" onClick={createRun} disabled={!actionsValidation.ok}><Sparkles size={18} /> 创建运行目录和提示词</button>
            <button className="primary" onClick={autoGenerateRun} disabled={!actionsValidation.ok || autoGenerating || !referencePath.trim()}>
              <Sparkles size={18} /> {autoGenerating ? '正在生成 GIF...' : '一键从参考图生成 GIF'}
            </button>
            <button className="secondary" onClick={processRun}>处理 decoded 动作条</button>
          </div>
        </div>
      </div>
      <div className="sprite-generator mark-generator">
        <div className="form-stack">
          <label>
            Job ID
            <input value={markJobId} onChange={(event) => setMarkJobId(event.target.value)} placeholder="canonical-base / idle / happy" />
          </label>
          <label>
            生成状态
            <select value={markStatus} onChange={(event) => setMarkStatus(event.target.value)}>
              <option value="generated">已生成</option>
              <option value="selected">已选中</option>
              <option value="needs-repair">需要修复</option>
              <option value="processed">已处理</option>
            </select>
          </label>
        </div>
        <div className="form-stack">
          <label>
            源文件路径
            <input value={markSourcePath} onChange={(event) => setMarkSourcePath(event.target.value)} placeholder="例如 decoded\\idle.png 或生成工具输出路径" />
          </label>
          <label>
            QA 备注
            <input value={markQaNote} onChange={(event) => setMarkQaNote(event.target.value)} placeholder="例如身份一致、帧数正确、需要重生成原因" />
          </label>
          <div className="visual-qa-checklist">
            <strong>视觉 QA：canonical-base</strong>
            <label>
              <input type="checkbox" checked={canonicalChecks.fullBodyVisible} onChange={(event) => setCanonicalCheck('fullBodyVisible', event.target.checked)} />
              单个完整角色，全身、居中、无裁切
            </label>
            <label>
              <input type="checkbox" checked={canonicalChecks.identityMatches} onChange={(event) => setCanonicalCheck('identityMatches', event.target.checked)} />
              脸、比例、颜色、材质、道具、轮廓和参考图一致
            </label>
            <label>
              <input type="checkbox" checked={canonicalChecks.flatChromaBackground} onChange={(event) => setCanonicalCheck('flatChromaBackground', event.target.checked)} />
              纯色 chroma key 背景，没有文字、阴影、地面、场景或白底
            </label>
            <label>
              <input type="checkbox" checked={canonicalChecks.readableAtCellSize} onChange={(event) => setCanonicalCheck('readableAtCellSize', event.target.checked)} />
              缩小到 192x208 仍然清晰可读
            </label>
            <strong>视觉 QA：逐动作</strong>
            <div className="visual-action-list">
              {visualReviewActions.map((action) => {
                const checks = actionChecks[action.id] || {};
                return (
                  <div className="visual-action-item" key={action.id}>
                    <span>{action.id}</span>
                    {action.description ? <p>{action.description}</p> : null}
                    {action.avoid ? <p>禁止：{action.avoid}</p> : null}
                    <label>
                      <input type="checkbox" checked={Boolean(checks.identityStable)} onChange={(event) => setActionCheck(action.id, 'identityStable', event.target.checked)} />
                      身份稳定，没有换角色、品种、服装或材质
                    </label>
                    <label>
                      <input type="checkbox" checked={Boolean(checks.actionMatches)} onChange={(event) => setActionCheck(action.id, 'actionMatches', event.target.checked)} />
                      动作符合 description，并用身体姿态表达
                    </label>
                    <label>
                      <input type="checkbox" checked={Boolean(checks.avoidRespected)} onChange={(event) => setActionCheck(action.id, 'avoidRespected', event.target.checked)} />
                      action avoid 禁止项未出现
                    </label>
                    <label>
                      <input type="checkbox" checked={Boolean(checks.fullCharacterVisible)} onChange={(event) => setActionCheck(action.id, 'fullCharacterVisible', event.target.checked)} />
                      每帧完整角色可见，没有裁切或跨格
                    </label>
                    <label>
                      <input type="checkbox" checked={Boolean(checks.noBannedElements)} onChange={(event) => setActionCheck(action.id, 'noBannedElements', event.target.checked)} />
                      没有文字、编号、边框、UI、气泡、特效、阴影、地面或场景
                    </label>
                    <label>
                      <input type="checkbox" checked={Boolean(checks.loopReadable)} onChange={(event) => setActionCheck(action.id, 'loopReadable', event.target.checked)} />
                      动画循环自然，小尺寸可读
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="event-buttons">
            <button className="secondary" onClick={importJobImage}>选择图片并导入 decoded</button>
            <button className="secondary" onClick={repairJob}>生成单动作修复提示词</button>
            <button className="secondary" onClick={markJob}>登记生成结果</button>
            <button className="secondary" onClick={() => reviewRun('failed')}>标记当前动作需修复</button>
            <button className="primary" onClick={() => reviewRun('accepted')} disabled={!visualChecksPassed}>视觉 QA 通过</button>
            <button className="primary" onClick={applyRun} disabled={!canApplySprite} title={applyDisabledReason}>应用到桌宠形象</button>
          </div>
        </div>
      </div>
      <div className="agent-card">
        <div>
          <strong>{displayText(generator.status, '未创建')}</strong>
          <p>运行目录：{safe(generator.currentRunDir, '暂无')}</p>
          <p>提示词目录：{generator.currentRunDir ? `${generator.currentRunDir}\\prompts` : '暂无'}</p>
          <p>动作条目录：{generator.currentRunDir ? `${generator.currentRunDir}\\decoded` : '暂无'}</p>
          <p>生成状态：{safe(generator.lastGenerationStatusPath, generator.currentRunDir ? `${generator.currentRunDir}\\generation-status.json` : '暂无')}</p>
          <p>Spritesheet：{safe(generator.lastSpritesheetPath, '暂无')}</p>
          <p>QA：{safe(generator.lastContactSheetPath, '暂无')}</p>
          <p>已应用：{safe(generator.appliedSprite?.runDir, '暂无')}</p>
        </div>
        <span>{message || '创建后先按 prompts 生成 canonical-base.png 和各 action.png，再执行处理。'}</span>
      </div>
      <div className="sprite-path-actions">
        <button className="secondary" onClick={refreshRun}>刷新状态和预览</button>
        <button className="secondary" onClick={() => openSpritePath('run')}>打开运行目录</button>
        <button className="secondary" onClick={() => openSpritePath('workflow')}>打开流程说明</button>
        <button className="secondary" onClick={() => openSpritePath('prompts')}>打开提示词</button>
        <button className="secondary" onClick={() => openSpritePath('decoded')}>打开 decoded</button>
        <button className="secondary" onClick={() => openSpritePath('final')}>打开 final</button>
        <button className="secondary" onClick={() => openSpritePath('outputManifest')}>打开输出索引</button>
        <button className="secondary" onClick={() => openSpritePath('qa')}>打开 QA</button>
      </div>
      {generationJobs.length ? (
        <ul className="event-list sprite-job-list">
          {generationJobs.map((job) => (
            <li key={job.id}>
              <span>{safe(job.id)} / {displayText(job.status, 'pending')}</span>
              <p>输出：{safe(job.outputPath, '暂无')}</p>
              <p>来源：{safe(job.sourcePath, '暂无')}</p>
              {job.repairPromptPath ? <p>修复提示词：{job.repairPromptPath}</p> : null}
              {job.qaNote ? <p>QA：{job.qaNote}</p> : null}
              <div className="sprite-job-actions">
                <button className="secondary" onClick={() => openJobPath(job.id, 'promptPath')}>打开提示词</button>
                <button className="secondary" onClick={() => openJobPath(job.id, 'outputPath')}>打开输出</button>
                {job.repairPromptPath ? (
                  <button className="secondary" onClick={() => openJobPath(job.id, 'repairPromptPath')}>打开修复提示词</button>
                ) : null}
              </div>
              <time>{job.frameCount ? `${job.frameCount} 帧` : displayText(job.kind, '基础图')}</time>
            </li>
          ))}
        </ul>
      ) : null}
      {(previewMedia.contactSheet?.url || previewMedia.spritesheet?.url || previewMedia.canonicalBase?.url || previewMedia.previews?.length) ? (
        <div className="sprite-preview-panel">
          <strong>生成预览</strong>
          <div className="sprite-preview-grid">
            {previewMedia.canonicalBase?.url ? (
              <figure>
                <img src={previewMedia.canonicalBase.url} alt="canonical-base" />
                <figcaption>canonical-base</figcaption>
              </figure>
            ) : null}
            {previewMedia.spritesheet?.url ? (
              <figure>
                <img src={previewMedia.spritesheet.url} alt="spritesheet" />
                <figcaption>spritesheet</figcaption>
              </figure>
            ) : null}
            {previewMedia.contactSheet?.url ? (
              <figure className="wide">
                <img src={previewMedia.contactSheet.url} alt="contact sheet" />
                <figcaption>contact-sheet</figcaption>
              </figure>
            ) : null}
            {(previewMedia.previews || []).map((preview) => (
              <figure key={preview.id}>
                <img src={preview.url} alt={`${preview.id} preview`} />
                <figcaption>{preview.id}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : null}
      {validationSummary?.exists ? (
        <div className="qa-summary">
          <strong>QA：{displayText(validationSummary.status)} / 错误 {safe(validationSummary.errorCount, 0)} / 提醒 {safe(validationSummary.warningCount, 0)}</strong>
          {validationSummary.runSummary ? (
            <div className="qa-item">
              <span>最终产物摘要 / {validationSummary.runSummary.readyForUse ? '可以用于桌宠' : '暂不能使用'}</span>
              <p>{validationSummary.runSummary.materialsReady ? '动作帧和 GIF 预览已通过 QA。' : '动作素材还需要自动检查和视觉 QA。'}</p>
              <p>{validationSummary.runSummary.readyForUse ? '已生成桌宠图集，可以应用到桌宠形象。' : safe(validationSummary.runSummary.readyReason, '需要自动检查通过，并且视觉 QA 接受后才能使用。')}</p>
              <p>自动检查：{validationSummary.runSummary.ok ? '通过' : '仍有问题'}</p>
              <p>Spritesheet：{safe(validationSummary.runSummary.spritesheet?.webp, validationSummary.runSummary.spritesheet?.png || '暂无')}</p>
              <p>输出索引：{safe(validationSummary.runSummary.outputManifest, '暂无')}</p>
              <p>帧目录：{safe(validationSummary.runSummary.framesDir, '暂无')}</p>
              <p>最终目录：{safe(validationSummary.runSummary.finalDir, '暂无')}</p>
              <p>预览目录：{safe(validationSummary.runSummary.qa?.preview_dir, '暂无')}</p>
              {(validationSummary.runSummary.actions || []).map((action) => (
                <p key={`summary_${action.id}`}>{safe(action.id)}：{safe(action.transparentStrip, '暂无')}</p>
              ))}
            </div>
          ) : null}
          {validationSummary.manualReview ? (
            <div className="qa-item">
              <span>人工视觉 QA / {displayText(validationSummary.manualReview.status)}</span>
              <p>清单：{safe(validationSummary.manualReview.path, '暂无')}</p>
              <p>{safe(validationSummary.manualReview.reason, '需要检查角色身份、动作语义和禁止项。')}</p>
              {validationSummary.manualReview.reviewedAt ? <p>时间：{validationSummary.manualReview.reviewedAt}</p> : null}
              {validationSummary.manualReview.failedJobs?.length ? <p>需修复：{validationSummary.manualReview.failedJobs.join('、')}</p> : null}
            </div>
          ) : null}
          {validationSummary.visualReview ? (
            <div className="qa-item">
              <span>视觉结论 / {displayText(validationSummary.visualReview.status)}</span>
              <p>{safe(validationSummary.visualReview.note, '暂无备注')}</p>
              {validationSummary.visualReview.failedJobs?.length ? <p>失败动作：{validationSummary.visualReview.failedJobs.join('、')}</p> : null}
              {validationSummary.visualReview.checklist?.actions?.length ? (
                <p>结构化检查：{validationSummary.visualReview.checklist.actions.map((item) => (
                  `${item.id}:${item.identity_stable && item.action_matches_description && item.avoid_list_respected ? '通过' : '需复核'}`
                )).join('、')}</p>
              ) : null}
            </div>
          ) : null}
          {validationSummary.canonicalBase ? (
            <div className="qa-item">
              <span>canonical-base / {displayText(validationSummary.canonicalBase.status)}</span>
              {[...(validationSummary.canonicalBase.errors || []), ...(validationSummary.canonicalBase.warnings || [])].map((item, index) => (
                <p key={`base_${index}`}>{item}</p>
              ))}
            </div>
          ) : null}
          {(validationSummary.actions || []).map((action) => (
            <div className="qa-item" key={action.id}>
              <span>{safe(action.id)} / {displayText(action.status)} / {safe(action.actualFrames, '-')} / {safe(action.expectedFrames, '-')} 帧</span>
              {[...(action.errors || []), ...(action.warnings || [])].map((item, index) => (
                <p key={`${action.id}_${index}`}>{item}</p>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {generator.recentRuns?.length ? (
        <ul className="event-list">
          {generator.recentRuns.map((run) => (
            <li key={run.runDir}>
              <span>{safe(run.petName)} / {displayText(run.status)}</span>
              <p>{run.runDir}</p>
              <time>{run.processedAt || run.createdAt}</time>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Assets({ state }) {
  const slots = state.assetSlots || [];
  const categories = useMemo(() => [text.all, ...new Set(slots.map((slot) => slot.category || text.optional))], [slots]);
  const [category, setCategory] = useState(text.all);
  const shown = category === text.all ? slots : slots.filter((slot) => (slot.category || text.optional) === category);
  const configured = slots.filter((slot) => slot.assetUrl || slot.status === '\u5df2\u914d\u7f6e').length;
  const completeness = slots.length ? Math.round((configured / slots.length) * 100) : 0;

  return (
    <div className="page-grid">
      <SpriteGenerator state={state} />
      <section className="panel-card">
        <SectionTitle title="\u52a8\u4f5c\u5305\u5bfc\u5165\u6821\u9a8c">
          \u5bfc\u5165\u52a8\u4f5c\u5305\u65f6\u68c0\u67e5 manifest\u3001\u7d20\u6750\u8def\u5f84\u3001\u672a\u77e5\u69fd\u4f4d\u548c\u6587\u4ef6\u683c\u5f0f\u3002
        </SectionTitle>
        <div className="agent-card">
          <div>
            <strong>{safe(state.packageValidation?.status, '\u672a\u6821\u9a8c')}</strong>
            <p>\u95ee\u9898\uff1a{state.packageValidation?.issues?.length ? state.packageValidation.issues.join('\uff1b') : '\u65e0'}</p>
            <p>\u63d0\u9192\uff1a{state.packageValidation?.warnings?.length ? state.packageValidation.warnings.join('\uff1b') : '\u65e0'}</p>
          </div>
          <span>{state.packageValidation?.checkedAt ? new Date(state.packageValidation.checkedAt).toLocaleString() : '\u5c1a\u672a\u5bfc\u5165\u52a8\u4f5c\u5305'}</span>
        </div>
      </section>
      <section className="panel-card">
        <div className="asset-header">
          <div>
            <p className="eyebrow">事件驱动动作槽</p>
            <h2>{text.assetLibrary}</h2>
            <p>{text.assetHelp}</p>
          </div>
          <div className="event-buttons">
            <div className="asset-score">\u5b8c\u6574\u5ea6 {completeness}%</div>
            <button className="secondary" onClick={() => callApi('exportAssetPackage')}><FileDown size={16} /> \u5bfc\u51fa\u52a8\u4f5c\u5305</button>
            <button className="secondary" onClick={() => callApi('importAssetPackage')}><FileUp size={16} /> \u5bfc\u5165\u52a8\u4f5c\u5305</button>
          </div>
        </div>
        <div className="category-tabs">
          {categories.map((item) => (
            <button key={item} className={item === category ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>
          ))}
        </div>
        <div className="asset-grid">
          {shown.map((slot) => <AssetCard key={slot.id} slot={slot} />)}
        </div>
      </section>
    </div>
  );
}

function AssetCard({ slot }) {
  return (
    <article className={`asset-card ${slot.required ? 'required' : 'optional'}`}>
      <div className="asset-preview">
        {slot.assetUrl ? <img src={slot.assetUrl} alt={slot.name} /> : <span>{slot.required ? '\u5fc5' : '\u53ef'}</span>}
      </div>
      <div className="asset-body">
        <h3>{safe(slot.name, slot.id)}</h3>
        <p className="asset-id">{slot.id}</p>
        <p>{safe(slot.trigger, '\u5f85\u914d\u7f6e\u89e6\u53d1\u8bf4\u660e')}</p>
        <div className="tag-row">
          <span>{safe(slot.category, text.optional)}</span>
          <span>{slot.required ? text.required : text.optional}</span>
          <span>{safe(slot.status, '\u672a\u914d\u7f6e')}</span>
        </div>
        <small>{safe(slot.frameHint, '\u5efa\u8bae\u900f\u660e PNG/GIF/WebP')}</small>
      </div>
      <div className="asset-actions">
        <button onClick={() => callApi('replaceAsset', slot.id)}>{text.replaceAsset}</button>
        <button onClick={() => callApi('triggerEvent', slot.id)}>{text.test}</button>
      </div>
    </article>
  );
}

function Pomodoro({ state }) {
  const [focusMinutes, setFocusMinutes] = useState(state.pomodoro?.focusMinutes || 25);
  const [breakMinutes, setBreakMinutes] = useState(state.pomodoro?.breakMinutes || 5);
  const remaining = Number(state.pomodoro?.remainingSeconds || 0);
  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
  const seconds = Math.floor(remaining % 60).toString().padStart(2, '0');

  return (
    <section className="panel-card">
      <SectionTitle title={text.pomodoro}>
        \u4e13\u6ce8\u65f6\u684c\u5ba0\u964d\u4f4e\u6253\u6270\uff0c\u5b8c\u6210\u540e\u7528\u5e86\u795d\u52a8\u4f5c\u548c\u4f11\u606f\u63d0\u9192\u7ed9\u60c5\u7eea\u53cd\u9988\u3002
      </SectionTitle>
      <div className="pomodoro-face">
        <Clock size={44} />
        <strong>{displayText(state.pomodoro?.status, '\u7b49\u5f85\u5f00\u59cb')}</strong>
        <div className="timer-readout">{minutes}:{seconds}</div>
        <span>{safe(state.pomodoro?.focusMinutes, 25)} \u5206\u949f\u4e13\u6ce8 / {safe(state.pomodoro?.breakMinutes, 5)} \u5206\u949f\u4f11\u606f</span>
        <span>\u4eca\u65e5\u5b8c\u6210 {safe(state.pomodoro?.completedToday, 0)} \u8f6e</span>
      </div>
      <div className="inline-settings pomodoro-settings">
        <label>
          \u4e13\u6ce8\u5206\u949f
          <input type="number" min="1" max="180" value={focusMinutes} onChange={(event) => setFocusMinutes(Number(event.target.value))} />
        </label>
        <label>
          \u4f11\u606f\u5206\u949f
          <input type="number" min="1" max="60" value={breakMinutes} onChange={(event) => setBreakMinutes(Number(event.target.value))} />
        </label>
      </div>
      <div className="event-buttons">
        <button className="secondary" onClick={() => callApi('setPomodoroConfig', { focusMinutes, breakMinutes })}>{text.save}</button>
        <button className="primary" onClick={() => callApi('startPomodoro')}>{text.start}</button>
        <button className="secondary" onClick={() => callApi('pausePomodoro')}>{text.pause}</button>
        <button className="secondary" onClick={() => callApi('resetPomodoro')}>{text.reset}</button>
        <button className="secondary" onClick={() => callApi('completePomodoro')}>{text.complete}</button>
      </div>
    </section>
  );
}

function Memos({ state }) {
  const [body, setBody] = useState('');
  const [dueAt, setDueAt] = useState('');

  return (
    <div className="page-grid">
      <section className="panel-card">
        <SectionTitle title={text.memos}>
          \u684c\u5ba0\u4f1a\u628a\u5907\u5fd8\u5f55\u53d8\u6210\u6e29\u548c\u63d0\u9192\uff0c\u5f53\u5230\u70b9\u6216\u4efb\u52a1\u5b8c\u6210\u65f6\u89e6\u53d1\u5bf9\u5e94\u52a8\u4f5c\u3002
        </SectionTitle>
        <div className="memo-input">
          <input value={body} onChange={(event) => setBody(event.target.value)} placeholder="\u5e2e\u6211\u8bb0\u4e00\u4ef6\u4e8b..." />
          <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          <button className="primary" onClick={() => {
            if (!body.trim()) return;
            if (dueAt) callApi('addTimedMemo', body.trim(), new Date(dueAt).toISOString());
            else callApi('addMemo', body.trim());
            setBody('');
            setDueAt('');
          }}>{text.remember}</button>
        </div>
        <ul className="memo-list">
          {(state.memos || []).map((memo) => (
            <li key={memo.id} className={memo.status}>
              <NotebookPen size={18} />
              <span>{memo.text}</span>
              {memo.dueAt ? <time>{new Date(memo.dueAt).toLocaleString()}</time> : null}
              <button onClick={() => callApi('completeMemo', memo.id)}>{text.done}</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Events({ state }) {
  return (
    <div className="page-grid">
      <section className="panel-card">
        <SectionTitle title="本地智能体事件桥接">
          Codex / Claude Code 事件脚本可以把任务完成、等待权限和报错转发到桌宠。
        </SectionTitle>
        <div className="agent-card">
          <div>
            <strong>事件桥接：{displayText(state.agentBridge?.status)}</strong>
            <code>{safe(state.agentBridge?.endpoint)}</code>
            <p>Codex 脚本：{safe(state.hookScripts?.codexPath, '\u672a\u751f\u6210')}</p>
            <p>Claude 脚本：{safe(state.hookScripts?.claudePath, '\u672a\u751f\u6210')}</p>
            <p>安装状态：{displayText(state.hookScripts?.installStatus || state.hookScripts?.status)}</p>
          </div>
          <div className="event-buttons">
            <button className="secondary" onClick={() => callApi('restartAgentBridge')}>\u91cd\u542f\u670d\u52a1</button>
            <button className="secondary" onClick={() => callApi('generateHookScripts')}>生成事件脚本</button>
            <button className="secondary" onClick={() => callApi('scanHookTargets')}>\u626b\u63cf\u914d\u7f6e\u4f4d\u7f6e</button>
            <button className="secondary" onClick={() => callApi('generateHookSnippets')}>生成配置片段</button>
            <button className="secondary" onClick={() => callApi('installClaudeProjectHook')}>\u5b89\u88c5\u5230 Claude \u9879\u76ee</button>
            <button className="secondary" onClick={() => callApi('uninstallClaudeProjectHook')}>\u5378\u8f7d Claude \u9879\u76ee</button>
            <button className="secondary" onClick={() => callApi('installHookInstructions')}>\u751f\u6210\u5b89\u88c5\u8bf4\u660e</button>
          </div>
        </div>
      </section>
      <section className="panel-card">
        <SectionTitle title="事件脚本配置候选">
          \u8fd9\u91cc\u53ea\u505a\u53d1\u73b0\u548c\u7247\u6bb5\u751f\u6210\uff0c\u4e0d\u76f4\u63a5\u6539\u5199 Codex \u5168\u5c40\u914d\u7f6e\u3002
        </SectionTitle>
        <ul className="event-list">
          {(state.hookScripts?.configCandidates || []).map((item, index) => (
            <li key={`${item.path || 'candidate'}_${index}`}>
              <span>{safe(item.product)} / {displayText(item.type)}</span>
              <p>{safe(item.path)}</p>
              <time>{item.exists ? '\u5df2\u5b58\u5728' : '\u672a\u53d1\u73b0'} / {displayText(item.writeMode)}</time>
            </li>
          ))}
        </ul>
      </section>
      <section className="panel-card">
        <SectionTitle title="已安装事件脚本">
          自动安装只写当前项目的 Claude Code 本地设置文件，写入前会备份。
        </SectionTitle>
        <ul className="event-list">
          {(state.hookScripts?.installedTargets || []).map((item, index) => (
            <li key={`${item.path || 'installed'}_${index}`}>
              <span>{safe(item.product)} / {displayText(item.scope)} / {displayText(item.status)}</span>
              <p>{safe(item.path)}</p>
              <time>{item.backupPath ? `\u5907\u4efd\uff1a${item.backupPath}` : '\u65e0\u65e7\u6587\u4ef6\u5907\u4efd'}</time>
            </li>
          ))}
        </ul>
      </section>
      <EventPanel title="\u5168\u90e8\u4e8b\u4ef6\u65e5\u5fd7" events={state.events || []} />
    </div>
  );
}

function EventPanel({ title, events }) {
  return (
    <section className="panel-card">
      <SectionTitle title={title}>{text.safeLog}</SectionTitle>
      <EventList events={events} />
    </section>
  );
}

function EventList({ events }) {
  if (!events.length) return <p>{text.empty}</p>;
  return (
    <ul className="event-list">
      {events.map((event) => (
        <li key={event.id}>
          <span>{displayEventType(event.type)}</span>
          <p>{event.summary}</p>
          <time>{event.createdAt ? new Date(event.createdAt).toLocaleString() : ''}</time>
        </li>
      ))}
    </ul>
  );
}

function Privacy({ state }) {
  return (
    <div className="page-grid">
      <section className="panel-card">
        <SectionTitle title={text.privacy}>
          \u53ea\u505a\u72b6\u6001\u76d1\u63a7\uff0c\u4e0d\u8bfb\u53d6\u952e\u76d8\u5177\u4f53\u5185\u5bb9\uff0c\u4e0d\u622a\u56fe\uff0c\u4e0d\u8bb0\u5f55\u804a\u5929\u6b63\u6587\u3002
        </SectionTitle>
        <div className="privacy-grid">
          <PrivacyItem label="\u524d\u53f0\u5e94\u7528\u5206\u7c7b" keyName="foregroundCategory" value={state.privacy?.foregroundCategory} />
          <PrivacyItem label="\u7a97\u53e3\u6807\u9898\u5206\u7c7b" keyName="windowTitleClassification" value={state.privacy?.windowTitleClassification} />
          <PrivacyItem label="智能体事件脚本" keyName="agentHooks" value={state.privacy?.agentHooks} />
          <PrivacyItem label="\u5929\u6c14" keyName="weather" value={state.privacy?.weather} />
          <PrivacyItem label="\u952e\u76d8\u5177\u4f53\u5185\u5bb9" value={state.privacy?.keyboardContent} danger />
          <PrivacyItem label="\u622a\u56fe/\u5f55\u5c4f" value={state.privacy?.screenshot} danger />
        </div>
      </section>
      <section className="panel-card">
        <SectionTitle title="\u63a8\u7a97\u53e3\u4fdd\u62a4">
          \u5f3a\u4e92\u52a8\u53ea\u5728\u7528\u6237\u663e\u5f0f\u5f00\u542f\u3001\u89c6\u9891\u573a\u666f\u3001\u975e\u514d\u6253\u6270\u3001\u672a\u8d85\u6bcf\u65e5\u4e0a\u9650\u65f6\u6267\u884c\u3002
        </SectionTitle>
        <div className="stats-row">
          <StatCard icon={ListChecks} label="\u4eca\u65e5\u5df2\u89e6\u53d1" value={`${safe(state.pushWindowGuard?.usedToday, 0)}/${safe(state.preferences?.pushWindowDailyLimit, 2)}`} />
          <StatCard icon={Clock} label="\u9884\u544a\u79d2\u6570" value={`${safe(state.preferences?.pushWindowPreviewSeconds, 2)}s`} tone="amber" />
          <StatCard icon={Monitor} label="\u6700\u8fd1\u963b\u6b62\u539f\u56e0" value={safe(state.pushWindowGuard?.lastBlockedReason, '\u65e0')} tone="slate" />
          <StatCard icon={EyeOff} label="\u5f53\u524d\u514d\u6253\u6270" value={state.preferences?.dnd ? '\u5f00\u542f' : '\u5173\u95ed'} />
        </div>
      </section>
    </div>
  );
}

function PrivacyItem({ label, keyName, value, danger }) {
  return (
    <div className={`privacy-item ${danger ? 'danger' : ''}`}>
      <span>{label}</span>
      {keyName ? (
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => callApi('setPrivacy', keyName, event.target.checked)} />
      ) : (
        <strong>{value ? '\u5f00\u542f' : danger ? '\u7981\u6b62' : '\u5173\u95ed'}</strong>
      )}
    </div>
  );
}

function Settings({ state }) {
  const [apiKey, setApiKey] = useState(state.deepSeek?.apiKey || '');
  const [model, setModel] = useState(state.deepSeek?.model || 'deepseek-v4-flash');
  const [endpoint, setEndpoint] = useState(state.deepSeek?.endpoint || 'https://api.deepseek.com/chat/completions');

  return (
    <div className="page-grid">
      <section className="panel-card">
        <SectionTitle title="DeepSeek \u4e0e\u6027\u80fd">
          \u5927\u6a21\u578b\u53ea\u505a\u9ad8\u5c42\u51b3\u7b56\uff0c\u672c\u5730\u884c\u4e3a\u5f15\u64ce\u8d1f\u8d23\u5b89\u5168\u9650\u5236\u3001\u9891\u7387\u548c\u5b9e\u9645\u6267\u884c\u3002
        </SectionTitle>
        <div className="settings-grid">
          <StatCard icon={Brain} label="DeepSeek" value={state.preferences?.deepSeekKeyConfigured ? '\u5df2\u914d\u7f6e' : '\u672a\u914d\u7f6e'} />
          <StatCard icon={Gauge} label="\u52a8\u753b\u5e27\u7387" value="12-15 帧/秒" tone="amber" />
          <StatCard icon={Shield} label="\u5b89\u5168\u8fb9\u754c" value="\u672c\u5730\u9650\u5236" tone="slate" />
          <StatCard icon={CloudRain} label="\u5929\u6c14\u80fd\u529b" value={state.privacy?.weather ? '\u5141\u8bb8' : '\u5173\u95ed'} />
        </div>
        <div className="deepseek-form">
          <label>接口密钥<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-..." /></label>
          <label>\u6a21\u578b<input value={model} onChange={(event) => setModel(event.target.value)} /></label>
          <label>接口地址<input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} /></label>
          <p>请求参数：思考模式已开启 / 推理强度高 / 非流式返回</p>
          <div className="event-buttons">
            <button className="primary" onClick={() => callApi('saveDeepSeek', { apiKey, model, endpoint })}>{text.save}</button>
            <button className="secondary" onClick={() => callApi('testDeepSeek')}>\u6d4b\u8bd5\u8fde\u63a5</button>
          </div>
          <p>\u6d4b\u8bd5\u7ed3\u679c\uff1a{safe(state.deepSeek?.lastTest, '\u5c1a\u672a\u6d4b\u8bd5')}</p>
        </div>
      </section>
      <section className="panel-card">
        <SectionTitle title="DeepSeek \u51b3\u7b56\u65e5\u5fd7">
          \u68c0\u67e5\u6a21\u578b\u6bcf\u6b21\u53ea\u6536\u5230\u5b89\u5168\u6458\u8981\uff0c\u5e76\u89c2\u5bdf\u8fd4\u56de\u52a8\u4f5c\u662f\u5426\u88ab\u672c\u5730\u7b56\u7565\u9650\u5236\u3002
        </SectionTitle>
        <EventList events={(state.deepSeek?.decisionLogs || []).map((log, index) => ({
          id: `ai_${index}`,
          type: log.ok ? 'DeepSeek 成功' : 'DeepSeek 失败',
          summary: log.summary,
          createdAt: log.createdAt
        }))} />
      </section>
    </div>
  );
}

function App() {
  const { state, error } = useDesktopPetState();
  const [page, setPage] = useState('dashboard');

  useEffect(() => {
    decodeEscapedVisibleText(document.getElementById('root'));
  });

  if (error) return <div className="loading">{error}</div>;
  if (!state) return <div className="loading">{text.loading}</div>;

  const pages = {
    dashboard: Dashboard,
    training: Training,
    memory: Memory,
    assets: Assets,
    pomodoro: Pomodoro,
    memos: Memos,
    events: Events,
    privacy: Privacy,
    settings: Settings
  };
  const CurrentPage = pages[page] || Dashboard;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">\u5ba0</div>
          <div>
            <strong>{text.title}</strong>
            <span>{text.subtitle}</span>
          </div>
        </div>
        <nav>
          {navItems.map(([id, label, Icon]) => (
            <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}>
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <main className="content">
        <CurrentPage state={state} />
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
