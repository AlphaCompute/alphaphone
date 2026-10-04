import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const filesModule = '/@fs' + fileURLToPath(new URL('../../.eliza/client-features/plugins/plugin-files/src/browser/files.ts', import.meta.url));

test('independent hosts use the Files package with isolated databases and their own presentation', async ({ page }) => {
  await page.goto('/?mode=dev');
  const result = await page.evaluate(async module => {
    const { createBrowserFiles } = await import(module);
    const opened: string[] = [];
    const make = (databaseName: string) => createBrowserFiles({
      databaseName, archiveName: 'host.zip', pdfWorkerUrl: '', pdfAssetsBase: '/',
      openSelectedDocumentViewer: (name: string) => { opened.push(name); return () => {}; },
      runFilePicker: async (_choose: unknown, cancelled: unknown) => cancelled,
      inputFiles: async () => [],
    });
    const First = make('independent-first'), Second = make('independent-second');
    const first = new First(), second = new Second();
    const selected = await first.importFile(new File(['host bytes'], 'host.txt', { type: 'text/plain' }));
    await first.openSelected(selected);
    const before = await second.list({});
    const restored = new First();
    const entry = (await restored.list({})).entries[0];
    const selection = await restored.select({ id: entry.id });
    const attachment = await restored.attachment(selection);
    await restored.rename({ id: entry.id, expectedRevision: entry.revision, name: 'changed.txt' });
    let stale = false;
    try { await first.readSelected(selected); } catch { stale = true; }
    await first.forget(); await restored.forget();
    return { opened, secondCount: before.entries.length, text: atob(attachment.dataBase64), stale };
  }, filesModule);
  expect(result).toEqual({ opened: ['host.txt'], secondCount: 0, text: 'host bytes', stale: true });
});

test('the shared Files receipt prevents replay even after the saved file is deleted', async ({ page }) => {
  await page.goto('/?mode=dev');
  const result = await page.evaluate(async () => {
    const { BrowserFiles } = await import('/src/browser/files.ts');
    const files = new BrowserFiles(), signal = new AbortController().signal;
    const input = { operationId: 'durable-receipt', name: 'receipt.txt', mimeType: 'text/plain', dataBase64: btoa('exact receipt') };
    const first = await files.saveWorkflowAttachment(input, signal);
    const root = await files.list({}), folder = root.entries.find(entry => entry.name === 'Receipts')!;
    const entry = (await files.list({ id: folder.id })).entries[0];
    await files.delete({ id: entry.id, expectedRevision: entry.revision, confirmPermanent: true });
    const replay = await new BrowserFiles().saveWorkflowAttachment(input, signal);
    let mismatch = false;
    try { await files.saveWorkflowAttachment({ ...input, dataBase64: btoa('changed receipt') }, signal); } catch { mismatch = true; }
    return { identical: JSON.stringify(first) === JSON.stringify(replay), count: (await files.list({ id: folder.id })).entries.length, mismatch };
  });
  expect(result).toEqual({ identical: true, count: 0, mismatch: true });
});
