import { createScanPdf as createPdf } from '../../../../.eliza/client-features/plugins/plugin-files/src/documents/scan-pdf.ts';
import type { ScanTextLine } from './scan-text-layer';
import {registerPlugin} from '../platform-plugins';
const documents=registerPlugin<{exportPdf(input:{title:string;dataBase64:string}):Promise<{status:string;message:string}>}>('AlphaNoteDocuments',{
 web:()=>import('../runtime/browser-note-documents').then(module=>new module.BrowserNoteDocuments()),
});
export function createScanPdf(input:Blob|Blob[],signal:AbortSignal,textLayers?:ScanTextLine[][]) {
 return createPdf({title:'Alpha scan',creator:'Alpha Phone'},input,signal,textLayers);
}
export class ScanPdfExportError extends Error {}
export async function exportScanPdf(image:Blob|Blob[],signal:AbortSignal,title:string,textLayers?:ScanTextLine[][]){
 const bytes=await createScanPdf(image,signal,textLayers);let raw='';for(let index=0;index<bytes.length;index+=16384)raw+=String.fromCharCode(...bytes.subarray(index,index+16384));
 signal.throwIfAborted();try{return await documents.exportPdf({title,dataBase64:btoa(raw)});}catch(error){throw new ScanPdfExportError('PDF export unconfirmed.',{cause:error});}
}
