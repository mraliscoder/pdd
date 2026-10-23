import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { extractRuleReferences } from './rule-references.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = name => fs.readFile(path.join(root, `dist/data/${name}.json`), 'utf8').then(JSON.parse);
const [rules, signs, markings] = await Promise.all(['rules', 'signs', 'markings'].map(read));
let count = 0;
for (const chapter of rules) {
  const $ = cheerio.load(await fs.readFile(path.join(root, `sources/law/${chapter.id}.html`), 'utf8'));
  const content = $('.document-page__content').first();
  content.find('.document__edit, .document__insert, h1, script, style').remove();
  let i = 0;
  for (const paragraph of content.find('p').toArray()) {
    const parsed = extractRuleReferences(paragraph, chapter, rules, signs, markings);
    if ((!parsed.text && !$(paragraph).find('img').length) || /^-{3,}$/.test(parsed.text)) continue;
    const block = chapter.blocks[i++];
    if (!block || parsed.text !== block.text) throw Error(`Source text differs in chapter ${chapter.id}, paragraph ${i}`);
    block.references = parsed.references;
    count += parsed.references.filter(r => r.kind === 'marking').length;
  }
  if (i !== chapter.blocks.length) throw Error(`Paragraph count differs in chapter ${chapter.id}`);
}
// Enrichment must not change the edition, normative text, question bank or images.
await fs.writeFile(path.join(root, 'dist/data/rules.json'), JSON.stringify(rules));
console.log(`Enriched ${rules.length} chapters with ${count} marking references; normative text unchanged.`);
