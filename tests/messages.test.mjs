import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(fs.readFileSync('lib/messages.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const searchExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/message-search.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: searchExports });

const whatsappExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/whatsapp.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: whatsappExports, URL });

const formattingExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/message-formatting.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: formattingExports });

function load(client = null) {
  const data = new Map();
  const events = [];
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: (path) => path === "./message-search" ? searchExports : path === "./whatsapp" ? whatsappExports : ({ supabase: client }),
    localStorage: { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) },
    window: { dispatchEvent: (event) => events.push(event.type) },
    Event, crypto,
  });
  return { api: exports, data, events };
}
const input = { recipient_name: ' Priya ', country_code: '+91', phone_number: '98765 43210', message: 'Hello\nHow are you? & ☀' };

test('normalizes international phone inputs and preserves multiline Unicode messages', () => {
  const { api } = load();
  const result = api.normalizeInput(input);
  assert.equal(result.full_phone, '919876543210');
  assert.equal(result.recipient_name, 'Priya');
  assert.equal(result.message, input.message);
});

test('rejects blank content and malformed international phone numbers', () => {
  const { api } = load();
  for (const patch of [{ recipient_name: ' ' }, { message: ' ' }, { message: 'x'.repeat(4001) }, { country_code: '0' }, { country_code: '1234' }, { phone_number: '12' }, { phone_number: '1'.repeat(14) }]) {
    assert.throws(() => api.normalizeInput({ ...input, ...patch }));
  }
});

test('persists pending messages, notifies tabs, and removes sent items from queue', async () => {
  const { api, data, events } = load();
  await api.addMessage(api.normalizeInput(input));
  const rows = await api.getPending();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'pending');
  await api.markSent(rows[0].id);
  assert.equal((await api.getPending()).length, 0);
  assert.equal(JSON.parse(data.get(api.STORAGE_KEY))[0].status, 'sent');
  assert.equal(events.length, 2);
});

test('corrupted local storage fails without overwriting saved data', async () => {
  const { api, data } = load();
  data.set(api.STORAGE_KEY, 'not-json');
  await assert.rejects(api.addMessage(api.normalizeInput(input)));
  assert.equal(data.get(api.STORAGE_KEY), 'not-json');
});

test('configured Supabase failures do not silently save to local storage', async () => {
  const failure = { message: 'Database unavailable' };
  const { api, data } = load({ from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ error: failure }) }) }) }) });
  await assert.rejects(api.addMessage(api.normalizeInput(input)), (error) => error === failure);
  assert.equal(data.size, 0);
});

test('denied or missing database updates are reported', async () => {
  const { api } = load({ from: () => ({ update: () => ({ eq: () => ({ select: async () => ({ data: [], error: null }) }) }) }) });
  await assert.rejects(api.markSent('missing'), /could not be updated/);
});

test('history includes opened messages and restores the original row without duplicating it', async () => {
  const { api, data } = load();
  await api.addMessage(api.normalizeInput(input));
  const [row] = await api.getPending();
  assert.equal((await api.getHistory()).length, 0);
  await api.markSent(row.id);
  assert.equal((await api.getHistory())[0].id, row.id);
  await api.restoreMessage(row.id);
  assert.equal((await api.getHistory()).length, 0);
  assert.equal((await api.getPending())[0].id, row.id);
  assert.equal(JSON.parse(data.get(api.STORAGE_KEY)).length, 1);
  await assert.rejects(api.restoreMessage(row.id), /no longer in history/);
});

test('failed Supabase restore reports the error without touching local storage', async () => {
  const failure = { message: 'Policy denied' };
  const chain = { eq: () => chain, select: async () => ({ data: null, error: failure }) };
  const { api, data } = load({ from: () => ({ update: () => chain }) });
  await assert.rejects(api.restoreMessage('sent-id'), (error) => error === failure);
  assert.equal(data.size, 0);
});


test('preserves leading/trailing whitespace, blank lines, Unicode, and formatting through storage', async () => {
  const { api } = load();
  const message = '  *Hello* 👋\n\n  - first\n  - second\n\n~bye~ _italic_ `code` & + # %\n  ';
  await api.addMessage(api.normalizeInput({ ...input, message }));
  const [row] = await api.getPending();
  assert.equal(row.message, message);
  const url = new URL(`https://wa.me/${row.full_phone}?text=${encodeURIComponent(row.message)}`);
  assert.equal(url.searchParams.get('text'), message);
});

test('searches all local pages and normalizes formatted phone searches', async () => {
  const { api, data } = load();
  const base = api.normalizeInput(input);
  const rows = Array.from({ length: 1050 }, (_, i) => ({ ...base, id: String(i), status: 'pending', created_at: new Date(1700000000000 + i * 1000).toISOString(), recipient_name: `Person ${i}`, message: i === 0 ? 'Hidden needle' : 'Other' }));
  data.set(api.STORAGE_KEY, JSON.stringify(rows));
  assert.equal((await api.getMessagePage('pending', '', 1, 6)).messages.length, 6);
  assert.equal((await api.getMessagePage('pending', '', 1, 6)).total, 1050);
  const found = await api.getMessagePage('pending', 'person needle', 1, 6);
  assert.equal(found.total, 1);
  assert.equal(found.messages[0].id, '0');
  assert.equal((await api.getMessagePage('pending', '+91 (98765) 43210', 1, 6)).total, 1050);
  assert.equal((await api.getMessagePage('pending', 'absent', 1, 6)).total, 0);
});

test('pagination clamps after last-page removals and rejects invalid page sizes', async () => {
  const { api } = load();
  for (let i = 0; i < 7; i++) await api.addMessage(api.normalizeInput(input));
  const last = await api.getMessagePage('pending', '', 2, 6);
  assert.equal(last.messages.length, 1);
  await api.markSent(last.messages[0].id);
  const clamped = await api.getMessagePage('pending', '', 2, 6);
  assert.equal(clamped.page, 1);
  assert.equal(clamped.messages.length, 6);
  await assert.rejects(api.getMessagePage('pending', '', 1, 1000));
});

test('Supabase pagination applies server search, exact counts, stable ordering and bounded ranges', async () => {
  const calls = [];
  const chain = {};
  for (const method of ['select', 'eq', 'or', 'order']) chain[method] = (...args) => { calls.push([method, ...args]); return chain; };
  chain.range = async (...args) => { calls.push(['range', ...args]); return { data: [], count: 50, error: null }; };
  const { api } = load({ from: () => chain });
  const result = await api.getMessagePage('sent', 'Priya hello', 2, 12);
  assert.equal(result.total, 50);
  assert.equal(calls.filter(([method]) => method === 'or').length, 2);
  assert.equal(calls.find(([method]) => method === 'select')[2].count, 'exact');
  assert.deepEqual(calls.at(-1), ['range', 12, 23]);
});


test('identical submissions create independent rows, even after one is sent', async () => {
  const { api } = load();
  const valid = api.normalizeInput(input);
  await api.addMessage(valid);
  await api.addMessage(valid);
  const rows = await api.getPending();
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].id, rows[1].id);
  assert.equal(rows[0].full_phone, rows[1].full_phone);
  await api.markSent(rows[0].id);
  assert.equal((await api.getPending()).length, 1);
  await api.addMessage(valid);
  assert.equal((await api.getPending()).length, 2);
  assert.equal((await api.getHistory()).length, 1);
});

test('Supabase inserts each submission and verifies a new row was returned', async () => {
  const inserted = [];
  const client = { from: () => ({ insert: (row) => {
    inserted.push(row);
    return { select: (columns) => ({ single: async () => {
      assert.equal(columns, 'id');
      return { data: { id: crypto.randomUUID() }, error: null };
    } }) };
  } }) };
  const { api } = load(client);
  await api.addMessage(api.normalizeInput(input));
  await api.addMessage(api.normalizeInput(input));
  assert.equal(inserted.length, 2);
  assert.equal(inserted[0].full_phone, inserted[1].full_phone);
});

test('database uniqueness errors give a useful explanation instead of reporting success', async () => {
  const { api } = load({ from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ error: { code: '23505' } }) }) }) }) });
  await assert.rejects(api.addMessage(api.normalizeInput(input)), /Repeated phone numbers should be allowed/);
});

test('handoff lookup reads the latest pending version and rejects stale queue items', async () => {
  const { api, data } = load();
  await api.addMessage(api.normalizeInput(input));
  const [original] = await api.getPending();
  const stored = JSON.parse(data.get(api.STORAGE_KEY));
  stored[0].message = 'Updated immediately before opening';
  data.set(api.STORAGE_KEY, JSON.stringify(stored));
  assert.equal((await api.getPendingMessage(original.id)).message, 'Updated immediately before opening');
  await api.markSent(original.id);
  await assert.rejects(api.getPendingMessage(original.id), /no longer pending/);
});

test('deletes only the selected history row and leaves other rows untouched', async () => {
  const { api, data } = load();
  const valid = api.normalizeInput(input);
  await api.addMessage(valid);
  await api.addMessage(valid);
  const pending = await api.getPending();
  await api.markSent(pending[0].id);
  await api.markSent(pending[1].id);
  await api.deleteHistoryMessage(pending[0].id);
  const stored = JSON.parse(data.get(api.STORAGE_KEY));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].id, pending[1].id);
  await assert.rejects(api.deleteHistoryMessage(pending[0].id), /no longer in history/);
});

test('Supabase history deletion is restricted by UUID and sent status', async () => {
  const calls = [];
  const chain = {
    delete: () => { calls.push(['delete']); return chain; },
    eq: (...args) => { calls.push(['eq', ...args]); return chain; },
    select: async (...args) => { calls.push(['select', ...args]); return { data: [{ id: 'selected-id' }], error: null }; },
  };
  const { api } = load({ from: () => chain });
  await api.deleteHistoryMessage('selected-id');
  assert.deepEqual(calls, [
    ['delete'],
    ['eq', 'id', 'selected-id'],
    ['eq', 'status', 'sent'],
    ['select', 'id'],
  ]);
});

test('builds one official universal WhatsApp link with exact encoded text on every OS', () => {
  const text = 'Hello 👋\n\n*Bold* & 100%';
  const url = new URL(whatsappExports.buildWhatsAppUrl({ full_phone: '919876543210', message: text }));
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'wa.me');
  assert.equal(url.pathname, '/919876543210/');
  assert.equal(url.searchParams.get('text'), text);
});

test('collapses Markdown double-star runs to WhatsApp single-star bold syntax', () => {
  assert.equal(whatsappExports.normalizeWhatsAppText('**Bold** and ***also bold***'), '*Bold* and *also bold*');
  assert.equal(whatsappExports.normalizeWhatsAppText('Keep *correct* text'), 'Keep *correct* text');
  const { api } = load();
  assert.equal(api.normalizeInput({ ...input, message: '**Stored bold**' }).message, '*Stored bold*');
  const url = new URL(whatsappExports.buildWhatsAppUrl({ full_phone: '919876543210', message: '**Linked bold**' }));
  assert.equal(url.searchParams.get('text'), '*Linked bold*');
});

test('toggles every inline WhatsApp format on and off', () => {
  for (const [marker, placeholder] of [['*', 'bold text'], ['_', 'italic text'], ['~', 'strikethrough text'], ['`', 'code']]) {
    const applied = formattingExports.toggleInline('hello world', { start: 0, end: 5 }, marker, placeholder);
    assert.equal(applied.text, `${marker}hello${marker} world`);
    assert.equal(formattingExports.isInlineActive(applied.text, applied, marker), true);
    const removed = formattingExports.toggleInline(applied.text, applied, marker, placeholder);
    assert.equal(removed.text, 'hello world');
    assert.equal(formattingExports.isInlineActive(removed.text, removed, marker), false);
  }
});

test('toggles formatting off with a collapsed cursor inside formatted text', () => {
  const removed = formattingExports.toggleInline('Say *hello* now', { start: 7, end: 7 }, '*', 'bold text');
  assert.equal(removed.text, 'Say hello now');
  assert.deepEqual({ start: removed.start, end: removed.end }, { start: 6, end: 6 });
});

test('toggles bullet and quote formatting across selected lines', () => {
  for (const marker of ['- ', '> ']) {
    const applied = formattingExports.toggleLines('one\ntwo', { start: 0, end: 7 }, marker);
    assert.equal(applied.text, `${marker}one\n${marker}two`);
    assert.equal(formattingExports.isLineActive(applied.text, applied, marker), true);
    const removed = formattingExports.toggleLines(applied.text, applied, marker);
    assert.equal(removed.text, 'one\ntwo');
    assert.equal(formattingExports.isLineActive(removed.text, removed, marker), false);
  }
});
