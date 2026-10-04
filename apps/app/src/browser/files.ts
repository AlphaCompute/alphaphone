import { createBrowserFiles } from '../../../../.eliza/client-features/plugins/plugin-files/src/browser/files.ts';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { openSelectedDocumentViewer } from './selected-document-viewer';
import { runFilePicker, inputFiles } from './file-picker';
/** Keep installed data and Alpha presentation; storage behavior belongs to plugin-files. */
export const BrowserFiles = createBrowserFiles({
 databaseName: 'alpha.browser.files.v1',
 archiveName: 'Alpha files.zip',
 pdfWorkerUrl,
 pdfAssetsBase: '/pdfjs-assets/',
 openSelectedDocumentViewer,
 runFilePicker,
 inputFiles,
});
export type BrowserFiles = InstanceType<typeof BrowserFiles>;
