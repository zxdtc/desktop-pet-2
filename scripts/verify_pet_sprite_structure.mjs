import assert from 'node:assert/strict';
import {
  createSpriteActionStructureMessages,
  extractJsonObject,
  normalizeStructuredSpriteActions,
  parseAndValidateSpriteActions
} from '../src/shared/petSpriteActions.js';

const modelResult = {
  pet_name: 'Border Collie',
  style_notes: 'cute semi-realistic plush desktop pet, readable at 192x208',
  chroma_key: '#0000FF',
  actions: [
    {
      id: '待机',
      description: 'calm breathing loop, tiny blink, slight head bob',
      avoid: 'walking, waving'
    },
    {
      id: '开心',
      frame_count: 6,
      description: 'happy bounce in place, smiling, ears perk up',
      avoid: 'confetti'
    },
    {
      id: '难过',
      description: 'sad apologetic pose, ears droop, head lowers slightly',
      avoid: 'red X'
    }
  ]
};

const normalized = normalizeStructuredSpriteActions(modelResult);
assert.equal(normalized.ok, true);
assert.equal(normalized.data.pet_name, 'Border Collie');
assert.equal(normalized.data.chroma_key, '#0000FF');
assert.deepEqual(normalized.data.actions.map((action) => action.id), ['idle', 'happy', 'sad']);
assert.deepEqual(normalized.data.actions.map((action) => action.frame_count), [6, 6, 6]);
assert.equal(normalized.data.actions.length, 3);
for (const action of normalized.data.actions) {
  assert.match(action.description, /Use body posture and facial expression only/);
  assert.match(action.avoid, /text/);
  assert.match(action.avoid, /detached effects/);
}

const green = normalizeStructuredSpriteActions({
  actions: [{ id: 'sleep', description: 'sleepy breathing' }],
  chroma_key: '#00ff00'
});
assert.equal(green.data.chroma_key, '#00FF00');

const extracted = extractJsonObject(`Here is the JSON:\n\n\`\`\`json\n${JSON.stringify(modelResult)}\n\`\`\``);
assert.equal(extracted.pet_name, 'Border Collie');
assert.throws(() => extractJsonObject('not json'), /有效 JSON|JSON/);

const messages = createSpriteActionStructureMessages({
  petName: 'Border Collie',
  styleNotes: 'soft fluffy fur',
  chromaKey: '#0000FF',
  naturalLanguage: '待机、开心、难过，每个 6 帧'
});
assert.equal(messages.length, 2);
assert.match(messages[0].content, /Return only strict JSON/);
assert.match(messages[0].content, /Default frame_count to 6/);
assert.match(messages[1].content, /Border Collie/);

const invalid = normalizeStructuredSpriteActions({ actions: [] });
assert.equal(invalid.ok, false);
assert.match(invalid.errors[0], /1 个动作/);

const malformedActionText = JSON.stringify([{ id: 'idle', frame_count: 6 }]);
assert.equal(parseAndValidateSpriteActions(malformedActionText).ok, false);

console.log('pet sprite structure ok');
