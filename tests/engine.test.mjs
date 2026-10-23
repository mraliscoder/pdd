import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { blockOf, shuffle, examQuestions, extraQuestions, baseOutcome } from '../dist/engine.js';
const all = JSON.parse(fs.readFileSync(new URL('../dist/data/questions.json', import.meta.url)));
const pool = all.filter(q => q.category === 'A_B');
const questions = pool.filter(q => q.ticket === 1);
const answers = () => Object.fromEntries(questions.map(q => [q.id, q.correct]));
test('Each category contains all 40 complete tickets with valid answers', () => {
  assert.equal(all.length, 1600); assert.equal(new Set(all.map(q => q.id)).size, 1600);
  for (const category of ['A_B', 'C_D']) for (let ticket = 1; ticket <= 40; ticket++) {
    const qs = all.filter(q => q.category === category && q.ticket === ticket);
    assert.deepEqual(qs.map(q => q.number), Array.from({ length: 20 }, (_, i) => i + 1));
    for (const q of qs) { assert.ok(q.correct >= 0 && q.correct < q.answers.length); assert.ok(q.topics.length && q.explanation); }
  }
});
test('All question, sign and marking images are present locally', () => {
  const signs = JSON.parse(fs.readFileSync(new URL('../dist/data/signs.json', import.meta.url)));
  const markings = JSON.parse(fs.readFileSync(new URL('../dist/data/markings.json', import.meta.url)));
  for (const q of [...all, ...signs, ...markings]) if (q.image) assert.ok(fs.existsSync(new URL('../dist/' + q.image, import.meta.url)), q.image);
});
test('All 26 chapters and appendices are present with inline sign references', () => {
  const rules = JSON.parse(fs.readFileSync(new URL('../dist/data/rules.json', import.meta.url)));
  assert.equal(rules.filter(r => r.kind === 'rules').length, 26); assert.equal(rules.length, 48);
  assert.ok(rules.every(r => r.blocks.length > 1));
  assert.ok(rules[0].blocks.some(b => b.signs.includes('5.1')));
  assert.ok(rules[1].blocks.some(b => b.text.includes('2.1.1.')));
});
test('Random exam contains four intact five-question blocks', () => {
  let i = 0; const qs = examQuestions(pool, () => [0, .2, .5, .99][i++]);
  assert.equal(qs.length, 20); assert.equal(new Set(qs.map(q => q.id)).size, 20);
  for (let block = 0; block < 4; block++) { const part = qs.filter(q => blockOf(q) === block); assert.equal(part.length, 5); assert.equal(new Set(part.map(q => q.ticket)).size, 1); }
});
test('Perfect exam passes only after completion', () => {
  assert.equal(baseOutcome(questions, answers()).status, 'active');
  assert.equal(baseOutcome(questions, answers(), true).status, 'passed');
});
test('One error creates one extra block', () => {
  const a = answers(); a[questions[0].id] = -1;
  assert.deepEqual(baseOutcome(questions, a, true), { status: 'extra', blocks: [0] });
});
test('Two errors in different blocks create two extra blocks', () => {
  const a = answers(); a[questions[1].id] = -1; a[questions[12].id] = -1;
  assert.deepEqual(baseOutcome(questions, a, true), { status: 'extra', blocks: [0, 2] });
});
test('Two errors in same block fail immediately', () => {
  const a = { [questions[0].id]: -1, [questions[4].id]: -1 };
  assert.equal(baseOutcome(questions, a).status, 'failed');
});
test('Three errors in different blocks fail', () => {
  const a = answers(); [0, 5, 10].forEach(i => a[questions[i].id] = -1);
  assert.equal(baseOutcome(questions, a).status, 'failed');
});
test('Unanswered questions count as errors when the base timer expires', () => {
  const a = answers(); delete a[questions[0].id];
  assert.equal(baseOutcome(questions, a, true).status, 'extra');
  assert.equal(baseOutcome(questions, {}, true).status, 'failed');
});
test('Extra blocks are from the error groups, intact and never repeat questions', () => {
  const extra = extraQuestions(pool, questions, [1, 3], () => .5);
  assert.equal(extra.length, 10);
  assert.ok(extra.every(q => [1, 3].includes(blockOf(q)) && !questions.some(x => x.id === q.id)));
  for (const block of [1, 3]) assert.equal(new Set(extra.filter(q => blockOf(q) === block).map(q => q.ticket)).size, 1);
});
test('Marathon shuffle preserves the complete bank without changing source order', () => {
  const before = pool.map(q => q.id); const mixed = shuffle(pool);
  assert.equal(mixed.length, 800); assert.equal(new Set(mixed.map(q => q.id)).size, 800);
  assert.deepEqual(pool.map(q => q.id), before);
});
