// Preserve the type and position of each reference from the source HTML.
// A rule number, sign number and marking number can have the same text.
export function extractRuleReferences(paragraph, chapter, chapters, signs, markings) {
  const targets = new Map(chapters.map(c => [new URL(c.source).pathname.split('/').filter(Boolean).at(-1), c]));
  const fallback = ['signs', 'markings'].includes(chapter.kind) ? chapter : null;
  const chars = [], contexts = [];
  function walk(node, context = fallback) {
    if (node.type === 'text') {
      for (const char of node.data) {
        const normalized = /\s/.test(char) ? ' ' : char;
        if (normalized === ' ' && (!chars.length || chars.at(-1) === ' ')) continue;
        chars.push(normalized); contexts.push(context);
      }
      return;
    }
    if (node.name === 'a' && node.attribs?.href) {
      const key = new URL(node.attribs.href, chapter.source).pathname.split('/').filter(Boolean).at(-1);
      context = targets.get(key) || null;
    }
    for (const child of node.children || []) walk(child, context);
  }
  walk(paragraph);
  const text = chars.join('').trimEnd();
  const references = [];
  for (const match of text.matchAll(/\d+\.\d+(?:\.\d+)?/g)) {
    const target = contexts[match.index];
    const number = match[0];
    if (target?.kind === 'signs' && signs.some(s => s.number === number)) {
      references.push({ start: match.index, end: match.index + number.length, kind: 'sign', number });
    } else if (target?.kind === 'markings') {
      const group = target.title.replace(/^\d+\.\s*/, '');
      // The source illustrates 2.1.1–2.1.3 together in the 2.1 image.
      const asset = markings.find(m => m.group === group && m.number === number)
        || (/^2\.1\.[123]$/.test(number) ? markings.find(m => m.group === group && m.number === '2.1') : null);
      if (asset) references.push({ start: match.index, end: match.index + number.length, kind: 'marking', number, assetNumber: asset.number, group });
    }
  }
  return { text, references };
}
