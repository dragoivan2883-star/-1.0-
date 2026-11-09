import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createState, transition } from '../src/state.js';
import { greetingText, osagoText } from '../src/phrases.js';

const script = JSON.parse(await readFile(new URL('../src/scripts/osago.json', import.meta.url), 'utf8'));
const objections = JSON.parse(await readFile(new URL('../src/scripts/objections.json', import.meta.url), 'utf8'));

function advanceToMini(need = 'onlyOsago') {
  let state = createState();
  state = transition(state, 'convenient');
  state = transition(state, need);
  state = transition(state, 'toMini');
  return state;
}

test('five stages include a separate mini-KASKO stage before completion', () => {
  assert.deepEqual(script.stages.map(stage => stage.id), ['greeting', 'need', 'osago', 'mini', 'finish']);
  let state = createState();
  assert.equal(transition(state, 'stage', '4').stageIndex, 0);
  state = advanceToMini();
  assert.equal(state.stageIndex, 3);
  assert.equal(transition(state, 'stage', '4').stageIndex, 3);
  assert.equal(transition(state, 'toFinish').stageIndex, 4);
});

test('OSAGO, mini-KASKO interest and refusal each reach the correct end state', () => {
  for (const need of ['onlyOsago', 'extraProtection']) {
    let state = advanceToMini(need);
    assert.equal(state.need, need);
    for (const decision of ['miniYes', 'miniNo']) {
      let branch = transition(state, decision);
      assert.equal(branch.miniDecision, decision);
      assert.equal(branch.stageIndex, 3);
      branch = transition(branch, 'toFinish');
      for (const outcome of ['ready', 'calculation', 'declined']) {
        const finished = transition(branch, outcome);
        assert.equal(finished.outcome, outcome);
        assert.ok(script.outcomes[outcome]);
      }
    }
  }
});

test('callback and price objection keep the current stage; mode switch does too', () => {
  let state = transition(createState(), 'inconvenient');
  assert.equal(state.stageIndex, 0);
  assert.equal(state.notice, 'callback');
  state = transition(state, 'objections');
  state = transition(state, 'selectObjection', 'expensive');
  state = transition(state, 'closeObjections');
  assert.equal(state.stageIndex, 0);
  assert.equal(state.selectedObjection, 'expensive');
  state = transition(state, 'mode', 'expert');
  assert.equal(state.stageIndex, 0);
  assert.equal(state.mode, 'expert');
  assert.equal(transition(state, 'restart').mode, 'expert');
});

test('missing CRM-like data yields neutral phrases without invented values', () => {
  const empty = { clientName: null, managerName: null, vehicle: null, expiryDate: null, osago: { insurer: null, price: null } };
  const greeting = greetingText(script, empty);
  assert.match(greeting, /Добрый день/);
  assert.doesNotMatch(greeting, /undefined|null|\{\w+\}/);
  assert.equal(osagoText(script, empty), script.osagoOffer.unconfirmed);
  assert.equal(osagoText(script, { osago: { insurer: 'Компания', price: null } }), script.osagoOffer.unconfirmed);
  assert.match(osagoText(script, { osago: { insurer: 'Компания', price: 4500 } }), /4\s?500/);
});

test('all required objections are present and added responses are marked for approval', () => {
  assert.equal(objections.items.length, 11);
  assert.equal(objections.items.filter(item => item.status === 'specified').length, 6);
  assert.equal(objections.items.filter(item => item.status === 'draft').length, 5);
  assert.ok(objections.items.every(item => item.label && item.answer));
});
