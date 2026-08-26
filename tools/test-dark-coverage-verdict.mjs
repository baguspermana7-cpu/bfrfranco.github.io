import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveRenderCandidate } from './lib/dark-coverage-verdict.mjs';

const clean = Object.freeze({ darkFailure: null, lightFailure: null, renderError: null });
const darkFailure = Object.freeze({
  darkFailure: 'fixture.html body-lum=255',
  lightFailure: null,
  renderError: null
});

test('one clean pass cannot erase an initial failure', () => {
  const verdict = resolveRenderCandidate('fixture.html', darkFailure, [clean]);
  assert.match(verdict.renderError, /confirmation incomplete/i);
  assert.equal(verdict.darkFailure, 'fixture.html body-lum=255');
});

test('two independent clean confirmations clear a sweep-only candidate', () => {
  const verdict = resolveRenderCandidate('fixture.html', darkFailure, [clean, clean]);
  assert.deepEqual(verdict, clean);
});

test('a confirmation exception fails closed', () => {
  const thrown = Object.freeze({
    darkFailure: null,
    lightFailure: null,
    renderError: 'fixture.html render-error=TimeoutError'
  });
  const verdict = resolveRenderCandidate('fixture.html', darkFailure, [clean, thrown]);
  assert.equal(verdict.renderError, thrown.renderError);
});

test('an initial exception requires two clean confirmations', () => {
  const initialError = Object.freeze({
    darkFailure: null,
    lightFailure: null,
    renderError: 'fixture.html render-error=ConnectionClosedError'
  });
  assert.match(resolveRenderCandidate('fixture.html', initialError, [clean]).renderError, /confirmation incomplete/i);
  assert.deepEqual(resolveRenderCandidate('fixture.html', initialError, [clean, clean]), clean);
});

test('a reproduced theme failure remains blocking', () => {
  const verdict = resolveRenderCandidate('fixture.html', darkFailure, [clean, darkFailure]);
  assert.equal(verdict.darkFailure, darkFailure.darkFailure);
});
