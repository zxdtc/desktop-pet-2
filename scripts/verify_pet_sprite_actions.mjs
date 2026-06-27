import assert from 'node:assert/strict';

import { parseAndValidateSpriteActions, sanitizeSpriteActionId } from '../src/shared/petSpriteActions.js';

assert.equal(sanitizeSpriteActionId(' walk-right! '), 'walk-right');

const valid = parseAndValidateSpriteActions(JSON.stringify([
  {
    id: 'idle',
    frame_count: 6,
    description: 'calm breathing',
    avoid: 'walking'
  }
]));
assert.equal(valid.ok, true);
assert.deepEqual(valid.actions, [{
  id: 'idle',
  frame_count: 6,
  description: 'calm breathing',
  avoid: 'walking'
}]);

assert.equal(parseAndValidateSpriteActions('{bad').ok, false);
assert.match(parseAndValidateSpriteActions(JSON.stringify({ nope: [] })).errors[0], /actions/);
assert.match(parseAndValidateSpriteActions(JSON.stringify([])).errors[0], /1 个动作/);
assert.match(parseAndValidateSpriteActions(JSON.stringify([{ id: '!!!', frame_count: 1, description: 'bad id' }])).errors[0], /id/);
assert.match(parseAndValidateSpriteActions(JSON.stringify([
  { id: 'idle', frame_count: 1, description: 'one' },
  { id: 'idle', frame_count: 1, description: 'two' }
])).errors[0], /重复/);
assert.match(parseAndValidateSpriteActions(JSON.stringify([{ id: 'idle', frame_count: 0, description: 'bad frames' }])).errors[0], /frame_count/);
assert.match(parseAndValidateSpriteActions(JSON.stringify([{ id: 'idle', frame_count: 1, description: '' }])).errors[0], /description/);

console.log('pet sprite actions ok');
