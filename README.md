# Little Queue

A zero-auth WhatsApp message queue, built on the initialized Next.js App Router project with React, TypeScript, Tailwind CSS, and Supabase.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000. Without Supabase credentials, messages persist in localStorage and synchronize between tabs on the same browser/origin. Local mode does not share messages between devices or migrate them into Supabase. Browser storage must be available; storage failures are shown without clearing the form.

## Connect Supabase

1. Run `supabase/schema.sql` in your Supabase project's SQL Editor. It creates the table, constraints, anonymous access policies, and Realtime publication membership. For an existing table, review/migrate its schema first; `create table if not exists` does not change existing columns.
2. Set the following in `.env.local` (or copy `.env.example` first):

   ```ini
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   ```

3. Restart the dev server. For production, set both variables before building.
4. Open the app on two devices. Add a message on one; verify it appears on the other's queue and badge. Open WhatsApp and verify it disappears on both.

The initialized app uses Next.js, so `NEXT_PUBLIC_` replaces the original plan's Vite-specific `VITE_` variables. Both values are public browser credentials. Never use a service-role/secret key. The zero-auth policies intentionally let anyone with those credentials read all names, phone numbers, and messages, insert messages, and mark pending messages sent. This model provides no user isolation and is unsuitable for confidential queues without adding authentication and restrictive policies.

## Behavior

- Country code defaults to 91; phone inputs strip non-digits and are validated before saving.
- Successful inserts clear the form and refresh the pending count. Failed saves retain the draft.
- Queue lists pending messages newest first and listens to all table changes, with focus/online refresh and a 30-second polling fallback.
- Open WhatsApp fetches the latest row, copies the text, opens a direct encoded `wa.me` link, and moves the row to history. A database failure displays a warning.
- **Sent means handed off to WhatsApp, not delivered.** The user must press Send in WhatsApp. Closing the WhatsApp tab does not restore the queue entry. Two simultaneous operators can open the same message; this app is designed for one sender.
- Local storage is used only when credentials are absent. Configured database failures never silently switch storage modes. Shared mode requires a connection; offline writes are not queued.

## Checks

```sh
npm run lint
npm test
npx tsc --noEmit
npm run build
npm run test:e2e
```

Implementation reference: [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes). Next.js guidance is bundled in `node_modules/next/dist/docs/`.

If the environment prevents Turbopack from starting its local CSS worker, use `npm run build:webpack`. The production build was verified with this fallback. Data tests cover normalization, validation, persistence, sent transitions, corrupted storage preservation, and database failure handling. Live Supabase integration requires your project credentials and applied schema.

## History

The History tab shows messages opened in WhatsApp, with search by recipient, phone, or message and a **Move back to queue** action. It uses the existing `sent` status; dates are labeled **Added** because the original schema does not store opening times. Restoring retains the original message and creation date. History is a view of currently completed items, not an immutable activity log or delivery receipt.

Each history card also has its own Delete action with inline confirmation. It permanently deletes only that row by UUID; there is no bulk-delete control. For an existing Supabase project, run `supabase/migrations/20260907_delete_history_messages.sql` once to grant deletion of `sent` rows. Pending queue rows cannot be deleted through this policy.

For an existing Supabase installation, run `supabase/migrations/20260907_history_restore.sql` once to allow restores. Fresh setups include this policy in `supabase/schema.sql`. Local mode needs no migration.

## Pagination, search, and pasted messages

Queue and History use database-side search, exact result counts, and pages of 6, 12, or 24 messages. Search covers all rows, not just the current page or Supabase’s default response limit. It matches names, message text, and international phone numbers; formatted phone queries are normalized to digits. Multiple words may match across fields. New queries/page sizes reset the page; switching tabs preserves each view’s search and page. Background refreshes retain the visible cards.

The editor grows to fit pasted text (up to a comfortable scrollable height), retains whitespace and blank lines, and never silently truncates an oversized paste. The 4,000-character limit is validated before saving. Formatting controls insert WhatsApp’s own markers; a safe text renderer previews bold, italic, strikethrough, code, lists, and quotes. Preview styling is approximate; WhatsApp controls final font, line wrapping, and rendering. Document fonts/colors and HTML styling are not pasted. Existing saved text is not rewritten. The WhatsApp link encodes the stored message without trimming or reformatting it.

Consecutive asterisks are the one intentional normalization: `**bold**` becomes WhatsApp’s `*bold*` immediately while typing or pasting and is normalized again before storage and link creation. Runs longer than two also collapse to one asterisk.

The formatting toolbar is selection-aware. Bold, italic, strikethrough, inline code, bullet, and quote buttons expose their state with `aria-pressed`, highlight when the cursor/selection is formatted, and remove the same format when pressed again. Empty selections insert selected example text that can be replaced immediately. Bold and italic also support the standard ⌘/Ctrl+B and ⌘/Ctrl+I shortcuts.

Browser tests require Google Chrome and run an isolated, local-mode server on port 3100 with `.next-e2e` output. They do not use the configured Supabase database or send WhatsApp messages. Run `npm run test:e2e`; tests cover desktop, 390px mobile, and 320px mobile, search/pagination, restore, long text, and editor-to-link text fidelity. The text data tests also cover rows beyond 1,000 records and page recovery.

## Repeated recipients

Every completed form submission creates a separate message row, even for an identical phone number and message. Sending one affects only its UUID. Supabase saves request the inserted ID before showing success. The in-flight form guard only prevents accidental double-clicks during a single save; it does not block later submissions.

The fresh schema already allows repeated recipients. If an existing database rejects them with a uniqueness error, run `supabase/migrations/20260907_repeat_recipients.sql` in the SQL Editor. It removes simple phone-based unique constraints/indexes (including pending-only rules), while retaining rows and the UUID primary key. Custom expression indexes or triggers require separate inspection. This migration has not been applied automatically to the live project.

## WhatsApp drafts and updated queue messages

The Open WhatsApp action re-fetches that pending row by UUID immediately before handoff, so a missed Realtime event cannot send an older queue snapshot. It copies the exact latest text to the clipboard, then opens the official `wa.me` universal link on desktop and mobile. On macOS, this allows the browser to hand the link to the installed WhatsApp app according to the user's browser/system preference.

WhatsApp owns its composer and can preserve an unsent draft already stored for a conversation. A website cannot clear or edit that draft. If WhatsApp shows old text, select all in its message box and paste: the app has already copied the latest saved message. Always review before pressing Send. The queue marks the row as opened after the handoff; this still does not confirm delivery.
