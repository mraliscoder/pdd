import { shuffle, examQuestions, baseOutcome, extraQuestions } from './engine.js';
const $ = s => document.querySelector(s);
const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = async name => { const r = await fetch(`data/${name}.json`); if (!r.ok) throw Error(name); return r.json(); };
let data, session, query = '', signGroup = '', catalog = 'signs', timer;
const defaults = () => ({ category: 'A_B', history: {}, favorites: [], read: [], runs: [], lastChapter: '1', fontSize: 18, session: null });
let state;
try { state = { ...defaults(), ...JSON.parse(localStorage.getItem('pdd-practice-v1') || '{}') }; } catch { state = defaults(); }
function persist() { try { localStorage.setItem('pdd-practice-v1', JSON.stringify({ ...state, session })); } catch { toast('Браузер не разрешает сохранение. Прогресс доступен до закрытия страницы.'); } }
function toast(text) { $('#toast').textContent = text; $('#toast').classList.add('visible'); clearTimeout(timer); timer = setTimeout(() => $('#toast').classList.remove('visible'), 3500); }
const pool = () => data.questions.filter(q => q.category === state.category);
const currentQuestions = () => session.ids.map(id => data.byId[id]);
const mistakes = () => pool().filter(q => state.history[q.id]?.wrong);
const saved = () => pool().filter(q => state.favorites.includes(q.id));
const solved = () => pool().filter(q => state.history[q.id]?.attempts);
const cleanTitle = t => t.replace(/^\d+\.\s*/, '');
const label = () => state.category === 'A_B' ? 'A, B' : 'C, D';
const percent = (a, b) => b ? Math.round(a / b * 100) : 0;
function title(h, p = '', extra = '') { return `<div class="page-title"><div><h1>${h}</h1>${p ? `<p>${p}</p>` : ''}</div>${extra}</div>`; }
function button(text, action, cls = '', attrs = '') { return `<button class="btn ${cls}" data-action="${action}" ${attrs}>${text}</button>`; }
function signImage(s, cls = '') { return `<img class="${cls}" src="${escape(s.image)}" alt="Знак ${escape(s.number)}: ${escape(s.title)}" loading="lazy">`; }
function refText(block) {
  if (block.references) {
    let html = '', offset = 0;
    for (const ref of block.references) {
      html += escape(block.text.slice(offset, ref.start));
      const text = escape(block.text.slice(ref.start, ref.end));
      if (ref.kind === 'marking') {
        const marking = data.markings.find(m => m.number === ref.assetNumber && m.group === ref.group);
        html += marking ? `<button class="inline-sign inline-marking" data-marking="${escape(marking.number)}" data-group="${escape(marking.group)}" aria-label="Разметка ${escape(ref.number)}: увеличить">${text}<img src="${escape(marking.image)}" alt="" loading="lazy"></button>` : text;
      } else {
        const sign = data.signMap[ref.number];
        html += sign ? `<button class="inline-sign" data-sign="${escape(ref.number)}">${text}${signImage(sign)}</button>` : text;
      }
      offset = ref.end;
    }
    return html + escape(block.text.slice(offset));
  }
  const parts = block.text.split(/(\d+\.\d+(?:\.\d+)?)/g);
  return parts.map(t => block.signs.includes(t) && data.signMap[t] ? `<button class="inline-sign" data-sign="${t}">${escape(t)}${signImage(data.signMap[t])}</button>` : escape(t)).join('');
}
function home() {
  const n = solved().length, correct = solved().filter(q => !state.history[q.id].wrong).length;
  const last = data.rules.find(c => c.id === state.lastChapter) || data.rules[0];
  return `${title('Уверенность начинается<br>со знания правил.', 'Читайте, разбирайтесь и проверяйте себя — шаг за шагом.')}
    <section class="start-grid"><div class="blue-panel"><div><span class="pill light">Учебник ПДД</span><h2>Дорога понятнее,<br>когда знаешь правила.</h2><p>Полный текст с наглядными знаками<br>и удобным оглавлением.</p><a class="btn white" href="#rules/${last.id}">${state.read.length ? 'Продолжить чтение' : 'Открыть правила'} <span>↗</span></a></div><div class="road-art" aria-hidden="true"><span class="road-edge left"></span><span class="road-edge right"></span><span class="road-dash"></span><img src="${data.signMap['2.1'].image}" alt=""><img src="${data.signMap['4.1.1'].image}" alt=""></div></div>
    <section class="progress-panel"><div class="panel-heading"><h2>Мой прогресс</h2><span class="pill">${label()}</span></div><div class="progress-value">${percent(n, 800)}<span>%</span></div><div class="progress-track"><i style="width:${percent(n, 800)}%"></i></div><p>${n} из 800 вопросов разобрано</p><dl class="progress-facts"><div><dt>Верно в последний раз</dt><dd>${correct}</dd></div><div><dt>Нужно повторить</dt><dd>${mistakes().length}</dd></div><div><dt>Разделов прочитано</dt><dd>${state.read.filter(id => Number(id) <= 26).length} / 26</dd></div></dl></section></section>
    <div class="section-heading"><h2>Как будем заниматься?</h2><span>Выберите свой темп</span></div>
    <div class="study-options"><a href="#tickets"><span class="option-icon">▦</span><h3>Решать билеты</h3><p>40 билетов по 20 вопросов.<br>С объяснением каждого ответа.</p><span class="text-link">Выбрать билет ↗</span></a><a href="#topics"><span class="option-icon">☷</span><h3>Разобрать тему</h3><p>От приоритета на перекрёстке<br>до первой помощи.</p><span class="text-link">Открыть темы ↗</span></a><a href="#practice"><span class="option-icon">◷</span><h3>Проверить себя</h3><p>Случайные вопросы, марафон<br>или экзамен на время.</p><span class="text-link">Настроить тест ↗</span></a></div>
    ${session && !session.finished ? `<div class="resume-banner"><div><b>У вас есть незавершённое занятие</b><p>${escape(session.title)} · ${Object.keys(session.answers).length} ответов</p></div><a class="btn primary" href="#session">Продолжить</a></div>` : ''}
    <div class="section-heading"><h2>Правила под рукой</h2><a href="#rules">Все разделы ↗</a></div><div class="quick-rules">${[8, 13, 12].map(id => { const c = data.rules[id - 1]; return `<a href="#rules/${id}"><span>${id}</span><b>${cleanTitle(c.title)}</b><span>↗</span></a>`; }).join('')}</div>
    <p class="source-note">Текст ПДД: редакция от ${data.meta.edition}. База вопросов — учебная копия от ${new Date(data.meta.questionUpdatedAt).toLocaleDateString('ru')}. <a href="#sources">Подробнее об источниках</a></p>`;
}
function rules(id) {
  const c = data.rules.find(c => c.id === id);
  if (!c) {
    const chapters = data.rules.filter(c => (c.title + ' ' + c.blocks.map(b => b.text).join(' ')).toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')));
    return `${title('Правила дорожного движения', `Редакция от ${data.meta.edition} · Полный текст с приложениями`, '<a class="btn" href="data/pdd.txt" download="ПДД-РФ.txt">↓ Скачать ПДД</a>')}<label class="search"><span>⌕</span><input id="search" value="${escape(query)}" placeholder="Найти правило: например, обгон или 13.1" aria-label="Поиск в ПДД"></label>${chapters.length ? ['rules', 'signs', 'markings', 'vehicle'].map((kind, j) => { const group = chapters.filter(c => c.kind === kind); return group.length ? `<h2 class="group-heading">${['Правила', 'Приложение 1. Дорожные знаки', 'Приложение 2. Разметка', 'Допуск транспортных средств'][j]}</h2><div class="chapter-list">${group.map(c => `<a href="#rules/${c.id}"><span class="chapter-num">${c.title.match(/^\d+/)?.[0] || '—'}</span><div><h3>${escape(cleanTitle(c.title))}</h3>${query ? `<p>${escape(c.blocks.find(b => b.text.toLowerCase().includes(query.toLowerCase()))?.text.slice(0, 170) || '')}</p>` : ''}</div><span class="read-mark">${state.read.includes(c.id) ? '✓' : '↗'}</span></a>`).join('')}</div>` : ''; }).join('') : empty('Совпадений нет', 'Попробуйте другое слово или номер пункта.')}`;
  }
  state.lastChapter = c.id; persist();
  return `<div class="reader-layout"><aside class="toc"><a href="#rules">← Все правила</a><label>Перейти к разделу<select id="chapter-select">${data.rules.map(x => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${escape(x.title)}</option>`).join('')}</select></label><div class="toc-links">${data.rules.filter(x => x.kind === c.kind).map(x => `<a class="${x.id === id ? 'selected' : ''}" href="#rules/${x.id}">${escape(x.title)}</a>`).join('')}</div></aside><article class="reader" style="--reader-size:${state.fontSize}px"><div class="reader-tools"><span>ПДД · ${data.meta.edition}</span><div>${button('A−', 'font-down', 'small', 'aria-label="Уменьшить шрифт"')}${button('A+', 'font-up', 'small', 'aria-label="Увеличить шрифт"')}</div></div><h1>${escape(c.title)}</h1>${c.kind === 'signs' ? '<p class="reader-hint">Нажмите на изображение знака, чтобы рассмотреть его.</p>' : ''}${c.blocks.map((b, i) => `<div class="rule-block" id="paragraph-${i}"><p>${refText(b)}</p>${b.images.map(im => `<img class="rule-image" src="${im}" alt="Иллюстрация к правилу">`).join('')}</div>`).join('')}<div class="reader-end">${button(state.read.includes(id) ? '✓ Раздел прочитан' : 'Отметить прочитанным', 'read', state.read.includes(id) ? 'success' : 'primary', `data-id="${id}"`)}<a href="${c.source}" target="_blank" rel="noopener">Текст в источнике ↗</a></div><div class="reader-pagination">${Number(id) > 1 ? `<a class="btn" href="#rules/${Number(id) - 1}">← Предыдущий раздел</a>` : '<span></span>'}${Number(id) < data.rules.length ? `<a class="btn" href="#rules/${Number(id) + 1}">Следующий раздел →</a>` : ''}</div></article></div>`;
}
function signs() {
  const all = data[catalog]; const groups = [...new Set(all.map(s => s.group))];
  const items = all.filter(s => (!signGroup || s.group === signGroup) && `${s.number} ${s.title || ''} ${s.description || ''}`.toLowerCase().includes(query.toLowerCase()));
  return `${title('Знаки и разметка', 'Номер, изображение и значение — в одном месте.')}<div class="tabs"><button data-action="catalog" data-value="signs" class="${catalog === 'signs' ? 'active' : ''}">Дорожные знаки</button><button data-action="catalog" data-value="markings" class="${catalog === 'markings' ? 'active' : ''}">Разметка</button></div><div class="filter-row"><label class="search"><span>⌕</span><input id="search" value="${escape(query)}" placeholder="Поиск по номеру или названию" aria-label="Поиск знаков и разметки"></label><select id="sign-group" aria-label="Группа знаков"><option value="">Все группы</option>${groups.map(g => `<option ${signGroup === g ? 'selected' : ''}>${escape(g)}</option>`).join('')}</select></div><div class="result-count">Найдено: ${items.length}</div><div class="sign-grid">${items.map(s => `<button class="sign-card" ${catalog === 'signs' ? `data-sign="${s.number}"` : `data-marking="${s.number}" data-group="${escape(s.group)}"`}><img src="${s.image}" alt="${escape(s.title || s.description)}" loading="lazy"><span class="sign-number">${s.number}</span><h3>${escape(s.title || s.description.slice(0, 100))}</h3></button>`).join('')}</div>${!items.length ? empty('Ничего не найдено', 'Измените запрос или выберите другую группу.') : ''}<p class="source-note">Иллюстрированный справочник из открытой базы. Нормативные описания и условия применения — в <a href="#rules/27">приложениях к ПДД</a>.</p>`;
}
function empty(h, p) { return `<div class="empty"><span>◎</span><h2>${h}</h2><p>${p}</p></div>`; }
function tickets() {
  return `${title('Экзаменационные билеты', `Категории ${label()} · 40 билетов, 800 вопросов`)}<div class="info-strip"><span>В обучении объяснение появляется после ответа. В тесте — после завершения.</span><label>Режим <select id="ticket-mode"><option value="learn">Обучение</option><option value="test">Тест без подсказок</option></select></label></div><div class="ticket-grid">${Array.from({ length: 40 }, (_, i) => { const n = i + 1, qs = pool().filter(q => q.ticket === n), done = qs.filter(q => state.history[q.id]).length, errors = qs.filter(q => state.history[q.id]?.wrong).length; return `<button class="ticket ${done === 20 && !errors ? 'complete' : ''}" data-action="ticket" data-ticket="${n}"><span>Билет</span><strong>${n}</strong><div class="mini-track"><i style="width:${done * 5}%"></i></div><small>${errors ? `${errors} ошибок` : `${done} / 20 разобрано`}</small></button>`; }).join('')}</div><p class="source-note">${data.meta.questionStatus} <a href="#sources">Источник базы</a></p>`;
}
function topics() {
  const groups = [...new Set(pool().flatMap(q => q.topics))].sort((a, b) => a.localeCompare(b, 'ru'));
  return `${title('Тренировка по темам', 'Сосредоточьтесь на том, что требует внимания.')}<label class="search"><span>⌕</span><input id="search" value="${escape(query)}" placeholder="Найти тему" aria-label="Поиск тем"></label><div class="topic-list">${groups.filter(t => t.toLowerCase().includes(query.toLowerCase())).map(t => { const qs = pool().filter(q => q.topics.includes(t)), n = qs.filter(q => state.history[q.id] && !state.history[q.id].wrong).length; return `<div class="topic-row"><div><h3>${escape(t)}</h3><p>${qs.length} вопросов · ${n} отвечено верно</p><div class="mini-track"><i style="width:${percent(n, qs.length)}%"></i></div></div><div>${button('Учить', 'topic', '', `data-topic="${escape(t)}" data-mode="learn"`)}${button('Тест', 'topic', 'primary', `data-topic="${escape(t)}" data-mode="test"`)}</div></div>`; }).join('')}</div>`;
}
function practice() {
  return `${title('Проверьте свои знания', 'Тренируйтесь по всей базе или пройдите пробный экзамен.')}<div class="exam-banner"><div><span class="pill light">Пробный экзамен</span><h2>20 вопросов.<br>20 минут. Как на экзамене.</h2><p>Четыре тематических блока. За одну ошибку — 5 дополнительных вопросов; за две в разных блоках — 10. В дополнительных вопросах ошибаться нельзя.</p>${button('Начать экзамен', 'exam', 'white')}</div><div class="exam-clock" aria-hidden="true"><span>20<small>минут</small></span></div></div><h2 class="group-heading">Своя тренировка</h2><form id="practice-form" class="practice-form"><div class="form-field"><label for="practice-scope">Какие вопросы</label><select id="practice-scope"><option value="all">Вся база · 800 вопросов</option><option value="mistakes">Мои ошибки · ${mistakes().length}</option><option value="favorites">Избранное · ${saved().length}</option>${[...new Set(pool().flatMap(q => q.topics))].map(t => `<option value="topic:${escape(t)}">${escape(t)}</option>`).join('')}</select></div><div class="form-field"><label for="practice-count">Количество</label><select id="practice-count"><option>20</option><option>10</option><option>40</option><option>100</option><option value="all">Все вопросы (марафон)</option></select></div><div class="form-field"><label for="practice-mode">Режим</label><select id="practice-mode"><option value="test">Тест · разбор в конце</option><option value="learn">Обучение · разбор сразу</option></select></div><button class="btn primary" type="submit">Начать тренировку</button></form><p class="source-note">Экзамен использует структуру из <a href="https://www.consultant.ru/document/cons_doc_LAW_380236/f8d7876883620f8f1511a9ca70054b464f2f2619/" target="_blank" rel="noopener">пунктов 130–139 регламента МВД</a>. Это учебная симуляция на загруженной базе, а не официальный экзамен.</p>${state.runs.length ? `<h2 class="group-heading">Последние результаты</h2><div class="history-list">${state.runs.filter(r => r.category === state.category).slice(0, 8).map(r => `<div><span>${escape(r.title)}<small>${new Date(r.at).toLocaleString('ru')}</small></span><b>${r.correct} / ${r.total}</b><span>${escape(r.result)}</span></div>`).join('')}</div>` : ''}`;
}
function savedPage() {
  return `${title('Ошибки и избранное', 'Возвращайтесь к сложным вопросам, пока они не станут понятными.')}<div class="saved-actions"><section><h2>Повторить ошибки <span>${mistakes().length}</span></h2><p>Верный ответ убирает вопрос из этого списка.</p>${button('Разобрать ошибки', 'mistakes', 'primary', mistakes().length ? '' : 'disabled')}</section><section><h2>Избранное <span>${saved().length}</span></h2><p>Вопросы, которые вы отметили звёздочкой.</p>${button('Повторить избранное', 'favorites', '', saved().length ? '' : 'disabled')}</section></div>${[...new Map([...mistakes(), ...saved()].map(q => [q.id, q])).values()].map(q => `<div class="saved-row"><div><span class="muted">Билет ${q.ticket} · Вопрос ${q.number}${state.history[q.id]?.wrong ? ' · Ошибка' : ''}</span><h3>${escape(q.question)}</h3></div>${button('Разобрать', 'one', '', `data-id="${q.id}"`)}</div>`).join('') || empty('Пока всё чисто', 'Решайте билеты. Здесь появятся ошибки и отмеченные вопросы.')}`;
}
function sources() {
  return `${title('Источники и данные', 'Что загружено в приложение и когда обновлялась база.')}<article class="source-article"><h2>Текст правил</h2><p>Постановление Правительства РФ от 23.10.1993 № 1090, редакция от ${data.meta.edition}. Загружены 26 разделов, оба приложения, основные положения по допуску транспорта и перечень неисправностей. Из текста убраны редакторские справки об истории изменений; формулировки нормативных пунктов сохранены.</p><p><a href="${data.meta.rulesSource}" target="_blank" rel="noopener">Открыть текст в КонсультантПлюс ↗</a></p><a class="btn" href="data/pdd.txt" download>↓ Скачать текст ПДД</a><h2>Билеты и иллюстрации</h2><p>Открытый репозиторий etspring/pdd_russia. 40 билетов по 20 вопросов для AB и 40 для CD. Версия базы от ${new Date(data.meta.questionUpdatedAt).toLocaleDateString('ru')}. ${data.meta.questionStatus}</p><p>Объяснения импортированы вместе с вопросами. Тематическая группировка взята из этой базы; один вопрос может относиться к нескольким темам. Режим «Экзамен» формирует четыре блока по пять вопросов и дополнительные блоки из тех же групп.</p><p>Для знаков использован полный иллюстрированный снимок репозитория от 29.01.2025: в более новом снимке обнаружены отсутствующие файлы. Правовые условия применения читайте в актуальном тексте приложений к ПДД.</p><p><a href="${data.meta.questionSource}/tree/${data.meta.questionCommit}" target="_blank" rel="noopener">Источник вопросов и версия ↗</a> · <a href="${data.meta.questionSource}/tree/${data.meta.signsSnapshot}" target="_blank" rel="noopener">Источник иллюстраций ↗</a></p><h2>Хранение прогресса</h2><p>Ответы, ошибки, избранное и незавершённое занятие сохраняются в этом браузере. Учётная запись не нужна. Данные не синхронизируются между устройствами. Очистка данных браузера удалит прогресс.</p><div class="action-row">${button('Скачать прогресс', 'export')}${button('Сбросить прогресс', 'reset', 'danger')}</div><p class="source-note">Дата загрузки: ${new Date(data.meta.downloadedAt).toLocaleString('ru')}. Приложение не обновляет нормативные тексты автоматически.</p></article>`;
}
function start(qs, mode, name) {
  if (!qs.length) { toast('В этой подборке пока нет вопросов. Сначала решите несколько билетов.'); return; }
  if (session && !session.finished && !confirm('Начать новое занятие? Незавершённое занятие будет заменено, история ответов сохранится.')) return;
  session = { ids: qs.map(q => q.id), answers: {}, index: 0, mode, title: name, category: state.category, phase: 'base', started: Date.now(), deadline: mode === 'exam' ? Date.now() + 20 * 60000 : null, finished: false };
  persist(); if (location.hash === '#session') render(); else location.hash = 'session';
}
function record(q, answer) { const prev = state.history[q.id] || { attempts: 0, correct: 0 }; state.history[q.id] = { attempts: prev.attempts + 1, correct: prev.correct + Number(answer === q.correct), wrong: answer !== q.correct, at: Date.now() }; }
function finish(result, reason = '') {
  if (!session || session.finished) return;
  session.finished = true; session.result = result; session.reason = reason; session.ended = Date.now();
  const qs = currentQuestions(); const correct = qs.filter(q => session.answers[q.id] === q.correct).length;
  // Unseen questions after an early stop must not inflate learned progress or mistakes.
  state.runs.unshift({ title: session.title, category: session.category, at: Date.now(), total: qs.length, correct, result }); state.runs = state.runs.slice(0, 100);
  persist(); render();
}
function endBase() {
  const qs = currentQuestions(); const outcome = baseOutcome(qs, session.answers, true);
  if (outcome.status === 'extra') {
    qs.filter(q => session.answers[q.id] === undefined).forEach(q => { record(q, -1); session.answers[q.id] = -1; });
    const extra = extraQuestions(data.questions.filter(q => q.category === session.category), qs, outcome.blocks);
    session.baseCount = qs.length; session.ids.push(...extra.map(q => q.id)); session.index = qs.length; session.phase = 'extra'; session.deadline = Date.now() + extra.length * 60000; persist(); toast(`Дополнительный блок: ${extra.length} вопросов за ${extra.length} минут.`); render();
  } else finish(outcome.status === 'passed' ? 'Сдал' : 'Не сдал', outcome.reason);
}
function answer(index) {
  if (!session || session.finished) return;
  if (session.deadline && Date.now() >= session.deadline) { expire(); return; }
  const q = data.byId[session.ids[session.index]]; if (session.answers[q.id] !== undefined || index >= q.answers.length || index < 0) return;
  session.answers[q.id] = index; record(q, index);
  if (session.mode === 'exam') {
    if (session.phase === 'extra' && index !== q.correct) { finish('Не сдал', 'Ошибка в дополнительном блоке.'); return; }
    if (session.phase === 'base') { const o = baseOutcome(currentQuestions(), session.answers); if (o.status === 'failed') { finish('Не сдал', o.reason); return; } }
    if (session.ids.every(id => session.answers[id] !== undefined)) { if (session.phase === 'base') endBase(); else finish('Сдал'); return; }
  }
  persist(); render();
}
function expire() {
  if (!session || session.finished) return;
  if (session.phase === 'base') endBase(); else finish('Не сдал', 'Истекло время дополнительного блока.');
}
function next() {
  if (session.index < session.ids.length - 1) { session.index++; persist(); render(); }
  else { const first = session.ids.findIndex(id => session.answers[id] === undefined); if (first >= 0) { session.index = first; persist(); render(); } else if (session.mode !== 'exam') finish('Тренировка завершена'); }
}
function sessionPage() {
  if (!session) return `${title('Занятие не выбрано')}<a class="btn primary" href="#practice">Выбрать тренировку</a>`;
  if (session.finished) return results();
  const qs = currentQuestions(), q = qs[session.index], selected = session.answers[q.id];
  const reveal = session.mode === 'learn' && selected !== undefined;
  return `<div class="session-heading"><div><a href="#practice">← К тренировкам</a><h1>${escape(session.title)}</h1><p>${session.mode === 'learn' ? 'Обучение с объяснениями' : session.mode === 'exam' ? (session.phase === 'extra' ? 'Дополнительные вопросы · без права на ошибку' : 'Экзамен · четыре тематических блока') : 'Тест · ответы и объяснения в конце'}</p></div>${session.deadline ? '<div class="timer" id="timer" aria-label="Осталось времени"></div>' : `<span class="pill">${Object.keys(session.answers).length} / ${qs.length} ответов</span>`}</div><div class="question-layout"><section class="question-card"><div class="question-meta"><span>Вопрос ${session.index + 1} из ${qs.length}<small>Билет ${q.ticket}, вопрос ${q.number}</small></span><button class="favorite ${state.favorites.includes(q.id) ? 'selected' : ''}" data-action="favorite" data-id="${q.id}" aria-label="${state.favorites.includes(q.id) ? 'Убрать из избранного' : 'В избранное'}" aria-pressed="${state.favorites.includes(q.id)}">${state.favorites.includes(q.id) ? '★' : '☆'}</button></div>${q.image ? `<div class="question-figure"><img src="${q.image}" alt="Дорожная ситуация к вопросу: ${escape(q.question)}"></div>` : ''}<h2>${escape(q.question)}</h2><div class="answers">${q.answers.map((a, i) => `<button class="answer ${selected === i ? 'chosen' : ''} ${reveal && i === q.correct ? 'correct' : ''} ${reveal && selected === i && i !== q.correct ? 'incorrect' : ''}" data-action="answer" data-answer="${i}" ${selected !== undefined ? 'disabled' : ''}><span>${i + 1}</span>${escape(a)}${reveal && i === q.correct ? '<b>✓</b>' : ''}</button>`).join('')}</div>${reveal ? `<div class="explanation ${selected === q.correct ? 'good' : 'bad'}"><h3>${selected === q.correct ? 'Верно!' : 'Разберём ошибку'}</h3><p>${escape(q.explanation)}</p>${ruleLinks(q)}</div>` : selected !== undefined ? '<p class="answer-saved" role="status">Ответ сохранён. Разбор будет после завершения.</p>' : '<p class="keyboard-hint">Можно отвечать клавишами 1–5</p>'}<div class="question-bottom">${button('← Назад', 'prev', '', session.index === 0 ? 'disabled' : '')}${button(session.index === qs.length - 1 && session.mode !== 'exam' && qs.every(x => session.answers[x.id] !== undefined) ? 'Посмотреть результат' : 'Следующий →', 'next', 'primary')}</div></section><aside class="question-nav"><h3>Вопросы</h3><div class="question-dots">${qs.map((x, i) => `<button class="${session.index === i ? 'current' : ''} ${session.answers[x.id] !== undefined ? (session.mode === 'learn' ? (session.answers[x.id] === x.correct ? 'correct' : 'incorrect') : 'answered') : ''}" data-action="jump" data-index="${i}" aria-label="Вопрос ${i + 1}" ${session.phase === 'extra' && i < session.baseCount ? 'disabled' : ''}>${i + 1}</button>`).join('')}</div><p>Можно отвечать<br>в любом порядке.</p>${button('Завершить занятие', 'end', 'full')}<p class="muted">Занятие сохраняется автоматически.</p></aside></div>`;
}
function ruleLinks(q) { if (!/ПДД/.test(q.explanation)) return ''; return [...new Set((q.explanation.match(/(?:[Пп]ункт[а-я]*|п\.)\s*(\d+\.\d+(?:\.\d+)?)/g) || []).map(t => t.match(/\d+/)[0]))].filter(n => Number(n) <= 26).map(n => `<a href="#rules/${n}">Открыть раздел ${n} ПДД ↗</a>`).join(' '); }
function results() {
  const qs = currentQuestions(), good = qs.filter(q => session.answers[q.id] === q.correct).length;
  const wrong = qs.filter(q => session.answers[q.id] !== q.correct);
  return `${title(session.mode === 'exam' ? `Экзамен: ${session.result.toLowerCase()}` : 'Тренировка завершена', escape(session.title))}<section class="result-banner ${wrong.length ? '' : 'perfect'}"><strong>${good}<span> / ${qs.length}</span></strong><div><h2>${wrong.length ? 'Теперь понятно, что повторить.' : 'Отличная работа!'}</h2><p>${wrong.length ? `Ошибок и пропущенных вопросов: ${wrong.length}. Разберите их ниже.` : 'Вы ответили правильно на все вопросы.'}</p>${session.reason ? `<p>${escape(session.reason)}</p>` : ''}</div></section><div class="action-row">${wrong.length ? button('Повторить ошибки занятия', 'retry-wrong', 'primary') : ''}${button('Пройти ещё раз', 'retry')}<a class="btn" href="#practice">Все тренировки</a></div><h2 class="group-heading">Разбор ответов</h2>${qs.map((q, i) => `<details class="review" ${session.answers[q.id] !== q.correct ? 'open' : ''}><summary><span class="status-dot ${session.answers[q.id] === q.correct ? 'good' : 'bad'}">${session.answers[q.id] === q.correct ? '✓' : '×'}</span><span>${i + 1}. ${escape(q.question)}</span></summary><div class="review-body">${q.image ? `<img src="${q.image}" alt="Иллюстрация к вопросу ${i + 1}" loading="lazy">` : ''}<p class="muted">Ваш ответ: ${session.answers[q.id] >= 0 ? escape(q.answers[session.answers[q.id]]) : 'Нет ответа'}</p><p class="correct-text"><b>Верный ответ:</b> ${escape(q.answers[q.correct])}</p><p>${escape(q.explanation)}</p>${ruleLinks(q)} ${button(state.favorites.includes(q.id) ? '★ В избранном' : '☆ В избранное', 'favorite', 'small', `data-id="${q.id}"`)}</div></details>`).join('')}`;
}
function render() {
  const [rawRoute, id] = location.hash.slice(1).split('/');
  const route = rawRoute || 'home';
  if (route === 'session' && session) state.category = session.category;
  const pages = { home, rules: () => rules(id), signs, tickets, topics, practice, saved: savedPage, sources, session: sessionPage };
  $('#main').innerHTML = (pages[route] || home)();
  document.querySelectorAll('.question-figure').forEach(figure => {
    figure.setAttribute('role', 'button'); figure.tabIndex = 0;
    figure.setAttribute('aria-label', 'Увеличить дорожную ситуацию');
    figure.insertAdjacentHTML('beforeend', '<span class="zoom-hint">⊕ Увеличить</span>');
  });
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === route));
  $('#breadcrumb').textContent = ({ home: 'Моя подготовка', rules: 'Учебник ПДД', signs: 'Знаки и разметка', tickets: 'Билеты', topics: 'Темы', practice: 'Тесты и экзамен', saved: 'Повторение', session: 'Тренировка', sources: 'Источники' })[route] || 'Моя подготовка';
  $('#category').value = state.category; $('#category').disabled = route === 'session' && session && !session.finished;
  $('#error-count').textContent = mistakes().length || '';
  document.title = `${$('#breadcrumb').textContent} — ПДД · Практика`;
  updateTimer();
}
function updateTimer() { if ($('#timer') && session?.deadline) { const seconds = Math.max(0, Math.ceil((session.deadline - Date.now()) / 1000)); $('#timer').textContent = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`; } }
function showSign(s, marking = false) {
  $('#sign-dialog').classList.remove('image-viewer');
  $('#sign-dialog').classList.toggle('marking-viewer', marking);
  const appendix = data.rules.filter(c => c.kind === (marking ? 'markings' : 'signs') && (!marking || cleanTitle(c.title) === s.group));
  const grouped = marking && /^2\.1(?:\.[123])?$/.test(s.number);
  const number = grouped ? '2.1.1' : s.number;
  const official = appendix.flatMap(c => c.blocks.map(b => ({ ...b, chapter: c.id }))).find(b => new RegExp(`^${number.replaceAll('.', '\\.')}[\\s,]`).test(b.text));
  $('#sign-detail').innerHTML = `<img src="${s.image}" alt="${escape(marking ? `Разметка ${grouped ? '2.1.1–2.1.3' : s.number}` : s.title)}"><span class="sign-number">${grouped ? '2.1.1–2.1.3' : s.number}</span><h2>${escape(s.title || s.group)}</h2><p>${escape(official?.text || s.description || 'Условия применения приведены в приложении к ПДД.')}</p><a class="btn primary" href="#rules/${official?.chapter || appendix[0]?.id || '27'}">Открыть приложение ПДД</a>`;
  $('#sign-dialog').showModal();
}
function showQuestionImage(figure) {
  const img = figure.querySelector('img');
  $('#sign-dialog').classList.remove('marking-viewer');
  $('#sign-dialog').classList.add('image-viewer');
  $('#sign-detail').innerHTML = `<h2>Дорожная ситуация</h2><p>Прокрутите изображение в сторону, чтобы рассмотреть детали.</p><div class="image-pan"><img src="${escape(img.getAttribute('src'))}" alt="${escape(img.alt)}"></div>`;
  $('#sign-dialog').showModal();
}
document.addEventListener('click', e => {
  if (e.target.closest('#sign-dialog a[href^="#"]')) $('#sign-dialog').close();
  const figure = e.target.closest('.question-figure'); if (figure) { showQuestionImage(figure); return; }
  const sign = e.target.closest('[data-sign]'); if (sign) { showSign(data.signMap[sign.dataset.sign]); return; }
  const mark = e.target.closest('[data-marking]'); if (mark) { showSign(data.markings.find(m => m.number === mark.dataset.marking && m.group === mark.dataset.group), true); return; }
  const el = e.target.closest('[data-action]'); if (!el) return;
  const a = el.dataset.action;
  if (a === 'ticket') start(pool().filter(q => q.ticket === Number(el.dataset.ticket)), $('#ticket-mode').value, `Билет ${el.dataset.ticket} · ${label()}`);
  if (a === 'topic') start(shuffle(pool().filter(q => q.topics.includes(el.dataset.topic))), el.dataset.mode, el.dataset.topic);
  if (a === 'exam') start(examQuestions(pool()), 'exam', `Пробный экзамен · ${label()}`);
  if (a === 'mistakes') start(shuffle(mistakes()), 'learn', 'Повторение ошибок');
  if (a === 'favorites') start(shuffle(saved()), 'learn', 'Избранные вопросы');
  if (a === 'one') start([data.byId[el.dataset.id]], 'learn', 'Разбор вопроса');
  if (a === 'answer') answer(Number(el.dataset.answer));
  if (a === 'next') next();
  if (a === 'prev' && session.index > 0 && !(session.phase === 'extra' && session.index === session.baseCount)) { session.index--; persist(); render(); }
  if (a === 'jump') { session.index = Number(el.dataset.index); persist(); render(); }
  if (a === 'end' && confirm('Завершить занятие? Неотвеченные вопросы будут отмечены как пропущенные.')) finish(session.mode === 'exam' ? 'Не сдал' : 'Тренировка завершена', session.mode === 'exam' ? 'Экзамен завершён досрочно.' : '');
  if (a === 'favorite') { const id = el.dataset.id; state.favorites = state.favorites.includes(id) ? state.favorites.filter(x => x !== id) : [...state.favorites, id]; persist(); render(); }
  if (a === 'retry') start(currentQuestions().slice(0, session.baseCount || session.ids.length), session.mode, session.title);
  if (a === 'retry-wrong') start(currentQuestions().filter(q => session.answers[q.id] !== q.correct), 'learn', 'Повторение ошибок занятия');
  if (a === 'read') { state.read = state.read.includes(el.dataset.id) ? state.read.filter(x => x !== el.dataset.id) : [...state.read, el.dataset.id]; persist(); render(); }
  if (a === 'font-up' || a === 'font-down') { state.fontSize = Math.max(16, Math.min(24, state.fontSize + (a === 'font-up' ? 1 : -1))); persist(); render(); }
  if (a === 'catalog') { catalog = el.dataset.value; signGroup = ''; query = ''; render(); }
  if (a === 'export') { const url = URL.createObjectURL(new Blob([JSON.stringify({ ...state, session }, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'pdd-progress.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  if (a === 'reset' && confirm('Удалить всю историю ответов, избранное и прогресс чтения на этом устройстве?')) { state = defaults(); session = null; persist(); render(); toast('Прогресс сброшен.'); }
});
document.addEventListener('input', e => { if (e.target.id === 'search') { query = e.target.value; const pos = e.target.selectionStart; render(); $('#search').focus(); $('#search').setSelectionRange(pos, pos); } });
document.addEventListener('change', e => {
  if (e.target.id === 'category') { state.category = e.target.value; persist(); render(); }
  if (e.target.id === 'chapter-select') location.hash = `rules/${e.target.value}`;
  if (e.target.id === 'sign-group') { signGroup = e.target.value; render(); }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'practice-form') return; e.preventDefault();
  const scope = $('#practice-scope').value, count = $('#practice-count').value;
  let qs = scope === 'mistakes' ? mistakes() : scope === 'favorites' ? saved() : scope.startsWith('topic:') ? pool().filter(q => q.topics.includes(scope.slice(6))) : pool();
  qs = shuffle(qs); if (count !== 'all') qs = qs.slice(0, Number(count));
  start(qs, $('#practice-mode').value, count === 'all' ? `Марафон · вопросов: ${qs.length}` : `Тренировочный тест · вопросов: ${qs.length}`);
});
document.addEventListener('keydown', e => { if (e.target.matches('.question-figure') && ['Enter', ' '].includes(e.key)) { e.preventDefault(); showQuestionImage(e.target); return; } if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || $('#sign-dialog').open || location.hash !== '#session' || !session || session.finished) return; if (/^[1-5]$/.test(e.key)) answer(Number(e.key) - 1); if (e.key === 'ArrowRight') next(); });
$('#menu').addEventListener('click', () => { const open = document.body.classList.toggle('menu-open'); $('#menu').setAttribute('aria-expanded', String(open)); });
$('.close-dialog').addEventListener('click', () => $('#sign-dialog').close());
$('#sign-dialog').addEventListener('click', e => { if (e.target === $('#sign-dialog')) $('#sign-dialog').close(); });
window.addEventListener('hashchange', () => { query = ''; document.body.classList.remove('menu-open'); $('#menu').setAttribute('aria-expanded', 'false'); $('#sign-dialog').close(); render(); window.scrollTo(0, 0); $('#main').focus({ preventScroll: true }); });
try {
  const [rulesData, questions, signsData, markings, meta] = await Promise.all(['rules', 'questions', 'signs', 'markings', 'meta'].map(json));
  data = { rules: rulesData, questions, signs: signsData, markings, meta, byId: Object.fromEntries(questions.map(q => [q.id, q])), signMap: Object.fromEntries(signsData.map(s => [s.number, s])) };
  session = state.session;
  if (session && (!Array.isArray(session.ids) || session.ids.some(id => !data.byId[id]))) session = null;
  render();
  setInterval(() => { if (session && !session.finished && session.deadline && Date.now() >= session.deadline) expire(); else updateTimer(); }, 500);
} catch (e) { console.error(e); $('#main').innerHTML = '<div class="empty"><h1>Не удалось загрузить базу</h1><p>Обновите страницу. Для локального запуска используйте npm start и откройте http://localhost:4173.</p><button class="btn primary" onclick="location.reload()">Повторить загрузку</button></div>'; }
