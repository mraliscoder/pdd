import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as cheerio from 'cheerio';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'dist');
const repo = path.join(root, 'sources/pdd_russia');
const base = 'https://www.consultant.ru';
const indexUrl = `${base}/document/cons_doc_LAW_2709/`;
await fs.mkdir(path.join(output, 'data'), { recursive: true });
await fs.mkdir(path.join(root, 'sources/law'), { recursive: true });
await fs.mkdir(path.join(output, 'images/law'), { recursive: true });
async function download(url) {
  for (let n = 0; n < 3; n++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(30000) }); if (!r.ok) throw Error(`${r.status}: ${url}`); return Buffer.from(await r.arrayBuffer()); }
    catch (e) { if (n === 2) throw e; }
  }
}
const index = await download(indexUrl);
await fs.writeFile(path.join(root, 'sources/law/index.html'), index);
const $ = cheerio.load(index);
const edition = $('h1').first().text().match(/ред\. от ([\d.]+)/)?.[1] || 'не определена';
const links = [];
$('.document-page__toc a, .document-page__content a').each((i, el) => {
  const title = $(el).text().trim(); const href = $(el).attr('href');
  if (href && (/^\d+\. /.test(title) || /^Основные положения/.test(title) || /^Приложение\. Перечень/.test(title))) links.push({ title, url: new URL(href, base).href });
});
if (links.length < 36) throw Error(`Incomplete table of contents: ${links.length}`);
const signLinks = new Set(links.slice(26, 34).map(v => new URL(v.url).pathname.split('/').filter(Boolean).at(-1)));
// The latest repository has dangling image paths and GOST-only additions.
// Use its complete illustrated snapshot; normative text is loaded separately.
const signsSnapshot = '721d017cb9553820f9cd2bf268cc135cb8501adb';
const sourceSigns = JSON.parse((await download(`https://raw.githubusercontent.com/etspring/pdd_russia/${signsSnapshot}/signs/signs.json`)).toString());
const signs = Object.entries(sourceSigns).flatMap(([group, entries]) => Object.values(entries).map(s => ({ ...s, group, image: s.image.replace('./', '') })));
const signByNumber = Object.fromEntries(signs.map(s => [s.number, s]));
const chapters = [];
let imageNo = 0;
for (let i = 0; i < links.length; i++) {
  const link = links[i]; const cached = path.join(root, `sources/law/${i + 1}.html`);
  const raw = process.argv.includes('--cached') ? await fs.readFile(cached) : await download(link.url);
  await fs.writeFile(path.join(root, `sources/law/${i + 1}.html`), raw);
  const doc = cheerio.load(raw); const content = doc('.document-page__content').first();
  content.find('.document__edit, .document__insert, h1, script, style').remove();
  const blocks = [];
  for (const el of content.find('p').toArray()) {
    const p = doc(el); const text = p.text().trim().replace(/\s+/g, ' ');
    const imgs = [];
    for (const img of p.find('img').toArray()) {
      const src = doc(img).attr('src'); if (!src) continue;
      const url = new URL(src, base).href;
      const ext = path.extname(new URL(url).pathname) || '.png';
      const dest = `images/law/${++imageNo}${ext}`;
      await fs.writeFile(path.join(output, dest), await download(url));
      imgs.push(dest);
    }
    if ((!text && !imgs.length) || /^-{3,}$/.test(text)) continue;
    const refs = [];
    p.find('a[href]').each((j, a) => {
      const href = doc(a).attr('href');
      if ([...signLinks].some(h => href.includes(h))) {
        for (const number of doc(a).text().match(/\d+\.\d+(?:\.\d+)?/g) || []) if (signByNumber[number]) refs.push(number);
      }
    });
    if (i >= 26 && i < 34) for (const number of text.match(/\d+\.\d+(?:\.\d+)?/g) || []) if (signByNumber[number]) refs.push(number);
    blocks.push({ text, images: imgs, signs: [...new Set(refs)] });
  }
  if (blocks.length < 2) throw Error(`Empty chapter: ${link.title}`);
  chapters.push({ id: String(i + 1), number: i < 26 ? i + 1 : null, kind: i < 26 ? 'rules' : i < 34 ? 'signs' : i < 36 ? 'markings' : 'vehicle', title: link.title, source: link.url, blocks });
  console.log(`${i + 1}/${links.length}: ${link.title} (${blocks.length})`);
}
// Copy only assets actually used by the application.
const questions = [];
for (const category of ['A_B', 'C_D']) {
  const dir = path.join(repo, 'questions', category, 'tickets');
  for (const file of (await fs.readdir(dir)).filter(f => f.endsWith('.json'))) {
    const ticket = Number(file.match(/\d+/)[0]);
    const rows = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'));
    if (rows.length !== 20) throw Error(`Invalid ticket: ${file}`);
    rows.forEach((q, j) => questions.push({ id: `${category}-${ticket}-${j + 1}`, category, ticket, number: j + 1, question: q.question, image: q.image.includes('no_image') ? null : q.image.replace('./', ''), answers: q.answers.map(a => a.answer_text), correct: q.answers.findIndex(a => a.is_correct), explanation: q.answer_tip, topics: Array.isArray(q.topic) ? q.topic : [q.topic] }));
  }
}
questions.sort((a, b) => a.category.localeCompare(b.category) || a.ticket - b.ticket || a.number - b.number);
const markup = JSON.parse(await fs.readFile(path.join(repo, 'markup/markup.json'), 'utf8'));
const markings = Object.entries(markup).flatMap(([group, entries]) => Object.values(entries).map(s => ({ ...s, group, image: s.image.replace('./', '') })));
for (const image of new Set([...questions, ...signs, ...markings].map(v => v.image).filter(Boolean))) {
  await fs.mkdir(path.dirname(path.join(output, image)), { recursive: true });
  try { await fs.copyFile(path.join(repo, image), path.join(output, image)); }
  catch (e) { if (e.code !== 'ENOENT') throw e; await fs.writeFile(path.join(output, image), await download(`https://raw.githubusercontent.com/etspring/pdd_russia/${signsSnapshot}/${image}`)); }
}
const commit = execFileSync('git', ['-C', repo, 'log', '-1', '--format=%H|%cI'], { encoding: 'utf8' }).trim().split('|');
const meta = { downloadedAt: new Date().toISOString(), edition, rulesSource: indexUrl, questionSource: 'https://github.com/etspring/pdd_russia', questionCommit: commit[0], questionUpdatedAt: commit[1], signsSnapshot, questionStatus: 'Учебная база из открытого репозитория. Соответствие действующим билетам МВД не подтверждено.' };
for (const [name, data] of Object.entries({ rules: chapters, questions, signs, markings, meta })) await fs.writeFile(path.join(output, `data/${name}.json`), JSON.stringify(data));
await fs.writeFile(path.join(output, 'data/pdd.txt'), `ПДД РФ. Редакция от ${edition}\nИсточник: ${indexUrl}\n\n` + chapters.map(c => c.title + '\n\n' + c.blocks.map(b => b.text).join('\n\n')).join('\n\n\n'));
console.log(JSON.stringify({ chapters: chapters.length, questions: questions.length, signs: signs.length, lawImages: imageNo, meta }, null, 2));
