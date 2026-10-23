export const blockOf = q => Math.floor((q.number - 1) / 5);
export function shuffle(items, random = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function examQuestions(pool, random = Math.random) {
  return [0, 1, 2, 3].flatMap(block => {
    const tickets = [...new Set(pool.filter(q => blockOf(q) === block).map(q => q.ticket))];
    const ticket = tickets[Math.floor(random() * tickets.length)];
    return pool.filter(q => q.ticket === ticket && blockOf(q) === block).sort((a, b) => a.number - b.number);
  });
}
export function baseOutcome(questions, answers, complete = false) {
  const errors = questions.filter(q => (answers[q.id] !== undefined || complete) && answers[q.id] !== q.correct);
  const blocks = errors.map(blockOf);
  if (errors.length >= 3) return { status: 'failed', reason: 'Три ошибки в основном билете.' };
  if (new Set(blocks).size !== blocks.length) return { status: 'failed', reason: 'Две ошибки в одном тематическом блоке.' };
  if (!complete) return { status: 'active' };
  return errors.length ? { status: 'extra', blocks } : { status: 'passed' };
}
export function extraQuestions(pool, used, blocks, random = Math.random) {
  const usedIds = new Set(used.map(q => q.id));
  return blocks.flatMap(block => {
    const eligible = pool.filter(q => blockOf(q) === block && !usedIds.has(q.id));
    const tickets = shuffle([...new Set(eligible.map(q => q.ticket))], random);
    for (const ticket of tickets) {
      const group = eligible.filter(q => q.ticket === ticket);
      if (group.length === 5) return group.sort((a, b) => a.number - b.number);
    }
    throw new Error('Недостаточно вопросов для дополнительного блока');
  });
}
