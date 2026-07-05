import test from 'node:test';
import assert from 'node:assert/strict';
import { toast } from '../../ui/toast.js';

function makeEl() {
  return {
    className: '',
    textContent: '',
    style: {},
    removed: false,
    appendChild() {},
    remove() { this.removed = true; }
  };
}

function installFakeDom({ docked = false } = {}) {
  const created = [];
  const timers = [];
  const toastsWrap = { children: [], appendChild(el) { this.children.push(el); } };
  global.document = {
    body: { classList: { contains: cls => cls === 'is-docked' && docked } },
    getElementById(id) { return id === 'toasts' ? toastsWrap : null; },
    createElement() {
      const el = makeEl();
      created.push(el);
      return el;
    }
  };
  global.setTimeout = (fn, delay) => {
    timers.push({ fn, delay });
    return timers.length;
  };
  return { created, timers, toastsWrap };
}

test('toast appends a message element to #toasts with the given text', () => {
  const { created, toastsWrap } = installFakeDom();
  toast('Hyperspace jump');
  assert.equal(created.length, 1);
  assert.equal(created[0].textContent, 'Hyperspace jump');
  assert.equal(created[0].className, 'toast');
  assert.equal(toastsWrap.children.length, 1);
});

test('toast is suppressed while docked', () => {
  const { created } = installFakeDom({ docked: true });
  toast('Should not appear');
  assert.equal(created.length, 0);
});

test('toast is a no-op when the #toasts container is missing', () => {
  global.document = {
    body: { classList: { contains: () => false } },
    getElementById: () => null,
    createElement: () => { throw new Error('should not create an element'); }
  };
  assert.doesNotThrow(() => toast('no container'));
});

test('toast fades then removes the element after its scheduled timers fire', () => {
  const { created, timers } = installFakeDom();
  toast('Bye');
  assert.equal(timers.length, 1, 'schedules the fade-out timer');
  timers[0].fn();
  assert.equal(created[0].style.opacity, '0');
  assert.equal(timers.length, 2, 'schedules the removal timer after fade starts');
  assert.equal(created[0].removed, false);
  timers[1].fn();
  assert.equal(created[0].removed, true);
});

test('toast swallows DOM errors instead of throwing', () => {
  global.document = {
    body: { classList: { contains: () => false } },
    getElementById: () => { throw new Error('boom'); }
  };
  assert.doesNotThrow(() => toast('anything'));
});
