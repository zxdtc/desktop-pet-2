import assert from 'node:assert/strict';
import { createDefaultState } from '../src/shared/defaultState.js';
import { applyEvent, buildEvent } from '../src/shared/behaviorEngine.js';
import { buildMemoryContext, normalizeMemories } from '../src/shared/memoryEngine.js';

let state = createDefaultState();
state = applyEvent(state, buildEvent('agent_task_completed', '任务已完成'));
state = applyEvent(state, buildEvent('agent_task_completed', '任务再次完成'));
state = applyEvent(state, buildEvent('agent_task_completed', '任务第三次完成'));
state = applyEvent(state, buildEvent('hydration_reminder', '喝水提醒'));

assert.equal(state.memories.signals.eventCounts.agent_task_completed, 3);
assert.equal(state.memories.signals.eventCounts.hydration_reminder, 1);
assert.ok(state.memories.preferences.some((item) => item.id === 'likes_completion_celebration'));
assert.ok(state.memories.preferences.some((item) => item.id === 'benefits_from_care_reminders'));
assert.ok(state.memories.candidate.includes('用户可能喜欢任务完成后的开心庆祝动作。'));
assert.ok(state.memories.relationship.affinity > 20);
assert.ok(state.memories.relationship.careNeed > 20);

const context = buildMemoryContext(state.memories);
assert.ok(context.confirmed.length >= 1);
assert.ok(context.topPreferences.length >= 2);
assert.ok(context.relationship.affinity > 20);

const normalized = normalizeMemories({ confirmed: ['x'] });
assert.deepEqual(normalized.confirmed, ['x']);
assert.deepEqual(normalized.signals.eventCounts, {});

console.log('memory engine ok');
