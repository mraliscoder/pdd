import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extractRuleReferences } from '../scripts/rule-references.mjs';

const load = name => JSON.parse(fs.readFileSync(new URL(`../dist/data/${name}.json`, import.meta.url)));
const rules = load('rules'), signs = load('signs'), markings = load('markings');
const text = data => ({ type: 'text', data });
const link = (href, value) => ({ name: 'a', attribs: { href }, children: [text(value)] });
const parse = (children, chapter = rules[0]) => extractRuleReferences({ name: 'p', children }, chapter, rules, signs, markings);

test('Identical rule, sign and marking numbers retain their own meaning and position', () => {
  const result = parse([text('  1.1. Знак '), link(rules[26].source, '1.1'), text(' и\nразметка '), link(rules[34].source, '1.1'), text('.  ')]);
  assert.equal(result.text, '1.1. Знак 1.1 и разметка 1.1.');
  assert.deepEqual(result.references.map(r => r.kind), ['sign', 'marking']);
  assert.ok(result.references.every(r => r.start > 0 && result.text.slice(r.start, r.end) === '1.1'));
  assert.equal(result.references[1].group, 'Горизонтальная разметка');
});

test('Appendix definitions and ranges resolve vertical markings without matching signs', () => {
  const result = parse([text('2.1.1 - 2.1.3 - обозначают элементы дорожных сооружений; 2.2 - нижний край.')], rules[35]);
  assert.deepEqual(result.references.map(r => r.number), ['2.1.1', '2.1.3', '2.2']);
  assert.ok(result.references.every(r => r.kind === 'marking' && r.group === 'Вертикальная разметка'));
  assert.equal(result.references[0].assetNumber, '2.1');
});

test('Explicit links to rule clauses inside an appendix do not become illustrations', () => {
  const result = parse([text('Разметка 1.1 и '), link(rules[0].source, 'пункт 1.1')], rules[34]);
  assert.equal(result.references.length, 1);
  assert.equal(result.references[0].kind, 'marking');
});

test('Downloaded references preserve text offsets and point to existing illustrations', () => {
  let markingCount = 0;
  for (const chapter of rules) for (const block of chapter.blocks) {
    assert.ok(Array.isArray(block.references));
    let end = 0;
    for (const ref of block.references) {
      assert.ok(ref.start >= end && ref.end <= block.text.length);
      assert.equal(block.text.slice(ref.start, ref.end), ref.number);
      end = ref.end;
      if (ref.kind === 'marking') {
        markingCount++;
        assert.ok(markings.some(m => m.number === ref.assetNumber && m.group === ref.group));
      } else assert.ok(signs.some(s => s.number === ref.number));
    }
  }
  assert.ok(markingCount > 60);
  const shoulder = rules[0].blocks.find(b => b.text.startsWith('"Обочина"'));
  assert.ok(shoulder.references.some(r => r.kind === 'marking' && r.number === '1.2'));
  const mixed = rules[0].blocks.find(b => b.text.startsWith('"Пешеходный переход"'));
  assert.ok(mixed.references.some(r => r.kind === 'sign' && r.number === '5.19.1'));
  assert.ok(mixed.references.some(r => r.kind === 'marking' && r.number === '1.14.1'));
});
