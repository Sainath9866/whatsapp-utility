import { test, expect, type Page } from "@playwright/test";

const message = "  *Hello Priya* 👋\n\n- First item\n- Second item\n\n_See you soon_ & + # 100%\n  ";

async function captureOpenUrl(page: Page) {
  await page.evaluate(() => {
    window.open = (url?: string | URL) => {
      if (typeof url === "string") localStorage.setItem("captured-open-url", url);
      return null;
    };
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("test-seeded")) return;
    const rows = Array.from({ length: 29 }, (_, i) => ({
      id: `message-${i}`, recipient_name: `Recipient ${i}`, country_code: "91", phone_number: "9876543210", full_phone: "919876543210",
      message: i === 0 ? "Rare needle from oldest message" : `A thoughtful message ${i}`,
      status: i < 15 ? "pending" : "sent", created_at: new Date(1700000000000 + i * 1000).toISOString(),
    }));
    localStorage.setItem("whatsapp-queue:v1", JSON.stringify(rows));
    localStorage.setItem("test-seeded", "true");
  });
  await page.goto("/");
  await expect(page.getByText("Local mode", { exact: true })).toBeVisible();
});

test('searches across pages and keeps tab state, with no horizontal overflow', async ({ page }) => {
  await page.getByRole('button', { name: /Send Queue/ }).click();
  const queue = page.getByRole('region', { name: 'Send queue', exact: true });
  await expect(queue.getByRole('article')).toHaveCount(6);
  await queue.getByRole('button', { name: 'Next →' }).click();
  await expect(queue.getByText('7–12 of 15')).toBeVisible();
  await queue.getByLabel('Search queue').fill('needle');
  await expect(queue.getByRole('article')).toHaveCount(1);
  await expect(queue.getByRole('heading', { name: 'Recipient 0', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  const history = page.getByRole('region', { name: 'Message history', exact: true });
  await expect(history.getByRole('article')).toHaveCount(6);
  await history.getByRole('button', { name: 'Next →' }).click();
  await expect(history.getByText('7–12 of 14')).toBeVisible();
  await history.getByLabel('Search history').fill('+91 (98765) 43210');
  await expect(history.getByText('1–6 of 14')).toBeVisible();
  await history.getByLabel('Messages per page').selectOption('12');
  await expect(history.getByRole('article')).toHaveCount(12);
  await page.getByRole('button', { name: /Send Queue/ }).click();
  await expect(queue.getByLabel('Search queue')).toHaveValue('needle');
  await expect(queue.getByRole('article')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('preserves pasted message from editor through storage and WhatsApp URL', async ({ page }) => {
  await page.getByLabel('Recipient name').fill('Paste test recipient');
  await page.getByLabel('Phone number', { exact: true }).fill('9876543210');
  // insertText exercises the same native text insertion path without OS clipboard permissions.
  const editor = page.getByLabel('Your message');
  await editor.focus();
  await page.keyboard.insertText(message);
  await expect(editor).toHaveValue(message);
  await expect(page.locator('.preview-bg strong')).toHaveText('Hello Priya');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Add to queue', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Message added' })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('whatsapp-queue:v1')!).find((row: { recipient_name: string }) => row.recipient_name === 'Paste test recipient'));
  expect(saved.message).toBe(message);
  await page.getByRole('button', { name: /Send Queue/ }).click();
  const card = page.getByRole('article').filter({ hasText: 'Paste test recipient' });
  await captureOpenUrl(page);
  await card.getByRole('button', { name: 'Open WhatsApp', exact: true }).click();
  const url = await page.evaluate(() => localStorage.getItem('captured-open-url')!);
  await expect(card).toHaveCount(0);
  expect(new URL(url).searchParams.get('text')).toBe(message);
  await page.getByRole('button', { name: 'History', exact: true }).click();
  const historyCard = page.getByRole('article').filter({ hasText: 'Paste test recipient' });
  await historyCard.getByRole('button', { name: 'Move back to queue' }).click();
  await expect(historyCard).toHaveCount(0);
});

test('oversized paste stays intact and long unbroken messages fit the screen', async ({ page }) => {
  const editor = page.getByLabel('Your message');
  await editor.fill('x'.repeat(4100));
  await expect(editor).toHaveValue('x'.repeat(4100));
  await expect(page.getByRole('button', { name: 'Add to queue', exact: true })).toBeDisabled();
  await expect(page.getByText(/Shorten it by 100 characters/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const height = await editor.evaluate((element) => element.getBoundingClientRect().height);
  expect(height).toBeGreaterThan(180);
  expect(height).toBeLessThanOrEqual(640);
});

test('submitting the same number twice creates two independently actionable messages', async ({ page }) => {
  for (let i = 0; i < 2; i++) {
    await page.getByLabel('Recipient name').fill('Repeat recipient');
    await page.getByLabel('Phone number', { exact: true }).fill('9876543210');
    await page.getByLabel('Your message').fill('The same message, intentionally queued twice.');
    await page.getByRole('button', { name: 'Add to queue', exact: true }).click();
    await expect(page.getByLabel('Your message')).toHaveValue('');
  }
  await page.getByRole('button', { name: /Send Queue/ }).click();
  const queue = page.getByRole('region', { name: 'Send queue', exact: true });
  await queue.getByLabel('Search queue').fill('Repeat recipient');
  await expect(queue.getByRole('article')).toHaveCount(2);
  await captureOpenUrl(page);
  await queue.getByRole('button', { name: 'Open WhatsApp' }).first().click();
  await expect(queue.getByRole('article')).toHaveCount(1);
});

test('re-fetches and copies the latest saved text before opening WhatsApp', async ({ page }) => {
  await page.getByRole('button', { name: /Send Queue/ }).click();
  const queue = page.getByRole('region', { name: 'Send queue', exact: true });
  await queue.getByLabel('Search queue').fill('Recipient 14');
  await expect(queue.getByRole('article')).toContainText('A thoughtful message 14');

  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('whatsapp-queue:v1')!);
    rows.find((row: { id: string }) => row.id === 'message-14').message = 'Fresh text fetched at click time 👋\n\n*Latest version*';
    localStorage.setItem('whatsapp-queue:v1', JSON.stringify(rows));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => localStorage.setItem('captured-clipboard', text) },
    });
    window.open = (url?: string | URL) => {
      if (typeof url === 'string') localStorage.setItem('captured-open-url', url);
      return null;
    };
  });

  await queue.getByRole('button', { name: 'Open WhatsApp' }).click();
  const expected = 'Fresh text fetched at click time 👋\n\n*Latest version*';
  const url = new URL(await page.evaluate(() => localStorage.getItem('captured-open-url')!));
  expect(await page.evaluate(() => localStorage.getItem('captured-clipboard'))).toBe(expected);
  expect(url.hostname).toBe('wa.me');
  expect(url.searchParams.get('text')).toBe(expected);
  await expect(queue.getByText(/opened the latest message.*old draft/i)).toBeVisible();
});

test('deletes one selected history row only after inline confirmation', async ({ page }) => {
  await page.getByRole('button', { name: 'History', exact: true }).click();
  const history = page.getByRole('region', { name: 'Message history', exact: true });
  await history.getByLabel('Search history').fill('Recipient 15');
  const selected = history.getByRole('article').filter({ hasText: 'Recipient 15' });
  await expect(selected).toHaveCount(1);
  await selected.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(selected.getByText('Delete only this history message?')).toBeVisible();
  await selected.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(selected).toHaveCount(0);

  const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('whatsapp-queue:v1')!));
  expect(rows.some((row: { id: string }) => row.id === 'message-15')).toBe(false);
  expect(rows.some((row: { id: string }) => row.id === 'message-16')).toBe(true);
  expect(rows).toHaveLength(28);
});

test('converts pasted double stars to WhatsApp single-star bold immediately', async ({ page }) => {
  await page.getByLabel('Recipient name').fill('Bold formatting test');
  await page.getByLabel('Phone number', { exact: true }).fill('9876543210');
  const editor = page.getByLabel('Your message');
  await editor.fill('Hello **Priya**, this is ***important***.');
  await expect(editor).toHaveValue('Hello *Priya*, this is *important*.');
  await expect(page.locator('.preview-bg strong')).toHaveText(['Priya', 'important']);

  await page.getByRole('button', { name: 'Add to queue', exact: true }).click();
  await page.getByRole('button', { name: /Send Queue/ }).click();
  const queue = page.getByRole('region', { name: 'Send queue', exact: true });
  await queue.getByLabel('Search queue').fill('Bold formatting test');
  await captureOpenUrl(page);
  await queue.getByRole('button', { name: 'Open WhatsApp' }).click();
  const url = new URL(await page.evaluate(() => localStorage.getItem('captured-open-url')!));
  expect(url.searchParams.get('text')).toBe('Hello *Priya*, this is *important*.');
});

test('format toolbar highlights active styles and toggles every style off again', async ({ page }) => {
  const editor = page.getByLabel('Your message');
  const select = async (start: number, end: number) => editor.evaluate((element, range) => {
    const textarea = element as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(range.start, range.end);
    textarea.dispatchEvent(new Event('select', { bubbles: true }));
  }, { start, end });

  for (const [label, marker] of [['Bold', '*'], ['Italic', '_'], ['Strikethrough', '~'], ['Inline code', '`']]) {
    await editor.fill('hello world');
    await select(0, 5);
    const button = page.getByRole('button', { name: label, exact: true });
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await button.click();
    await expect(editor).toHaveValue(`${marker}hello${marker} world`);
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await button.click();
    await expect(editor).toHaveValue('hello world');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  }

  for (const [label, marker] of [['Bullet list', '- '], ['Quote', '> ']]) {
    await editor.fill('one\ntwo');
    await select(0, 7);
    const button = page.getByRole('button', { name: label, exact: true });
    await button.click();
    await expect(editor).toHaveValue(`${marker}one\n${marker}two`);
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await button.click();
    await expect(editor).toHaveValue('one\ntwo');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  }

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
