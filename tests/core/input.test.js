import test from 'node:test';
import assert from 'node:assert/strict';
import { initInput } from '../../core/input.js';

function setupDom({ visibleReport = false, reporting = false } = {}) {
  const listeners = {};
  global.window = {
    addEventListener(type, handler) {
      listeners[type] = handler;
    }
  };
  global.document = {
    body: {
      tagName: 'BODY',
      classList: { contains: cls => cls === 'is-reporting' && reporting }
    },
    getElementById(id) {
      if (id !== 'reportPanel') return null;
      return {
        classList: { contains: cls => cls === 'hidden' ? !visibleReport : false },
        getAttribute: name => name === 'aria-hidden' ? (visibleReport ? 'false' : 'true') : null
      };
    }
  };
  return listeners;
}

function makeState() {
  return {
    ship: {
      flare: 0,
      turn: 1,
      thrust: true,
      brake: true
    }
  };
}

function makeKeyEvent(code, target) {
  return {
    code,
    target,
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    prevented: false,
    preventDefault() {
      this.prevented = true;
    }
  };
}

test('gameplay input ignores typing in report text fields', () => {
  const listeners = setupDom();
  const state = makeState();
  let fired = false;
  initInput({
    isRunning: () => true,
    getState: () => state,
    fire: () => { fired = true; }
  });

  listeners.keydown(makeKeyEvent('Space', {
    tagName: 'TEXTAREA',
    isContentEditable: false
  }));

  assert.equal(fired, false);
});

test('visible report panel captures gameplay keys and releases held controls', () => {
  const listeners = setupDom({ visibleReport: true });
  const state = makeState();
  let fired = false;
  initInput({
    isRunning: () => true,
    getState: () => state,
    fire: () => { fired = true; }
  });

  listeners.keydown(makeKeyEvent('Space', {
    tagName: 'CANVAS',
    isContentEditable: false,
    closest: () => null
  }));

  assert.equal(fired, false);
  assert.equal(state.ship.turn, 0);
  assert.equal(state.ship.thrust, false);
  assert.equal(state.ship.brake, false);
});

test('reporting mode captures gameplay keys even when canvas still has focus', () => {
  const listeners = setupDom({ reporting: true });
  const state = makeState();
  let fired = false;
  initInput({
    isRunning: () => true,
    getState: () => state,
    fire: () => { fired = true; }
  });

  listeners.keydown(makeKeyEvent('Space', {
    tagName: 'CANVAS',
    isContentEditable: false,
    closest: () => null
  }));

  assert.equal(fired, false);
  assert.equal(state.ship.turn, 0);
  assert.equal(state.ship.thrust, false);
  assert.equal(state.ship.brake, false);
});
