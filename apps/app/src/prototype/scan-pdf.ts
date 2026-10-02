import {registerPlugin} from '../platform-plugins';
const documents=registerPlugin<{exportPdf(input:{title:string;dataBase64:string}):Promise<{status:string;message:string}>}>('AlphaNoteDocuments',{
 web:()=>import('../runtime/browser-note-documents').then(module=>new module.BrowserNoteDocuments()),
});
/** Image-only page: reviewed OCR corrections remain in the separate Notes draft. */
export async function createScanPdf(input:Blob|Blob[],signal:AbortSignal):Promise<Uint8Array<ArrayBuffer>>{
 signal.throwIfAborted();const images=Array.isArray(input)?[...input]:[input];if(!images.length||images.length>20||images.reduce((total,image)=>total+image.size,0)>64*1024*1024)throw Error('Choose 1 to 20 pages, up to 64 MB total.');
 const {PDFDocument}=await import('pdf-lib');signal.throwIfAborted();const pdf=await PDFDocument.create();
 for(const image of images){signal.throwIfAborted();
 if(!['image/jpeg','image/png','image/webp'].includes(image.type)||!image.size||image.size>16*1024*1024)throw Error('Choose a supported image up to 16 MB.');
 const bitmap=await createImageBitmap(image);let jpeg:Blob;
 try{
  signal.throwIfAborted();if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>32000000)throw Error('Image dimensions are too large.');
  const scale=Math.min(1,2048/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const context=canvas.getContext('2d');if(!context)throw Error('Image conversion is unavailable.');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  jpeg=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Image conversion failed.')),'image/jpeg',.9));
 }finally{bitmap.close();}
 signal.throwIfAborted();
 const picture=await pdf.embedJpg(await jpeg.arrayBuffer());signal.throwIfAborted();
 const landscape=picture.width>picture.height;const page=pdf.addPage(landscape?[841.89,595.28]:[595.28,841.89]);const margin=24;
 const scale=Math.min((page.getWidth()-margin*2)/picture.width,(page.getHeight()-margin*2)/picture.height);
 const width=picture.width*scale,height=picture.height*scale;page.drawImage(picture,{x:(page.getWidth()-width)/2,y:(page.getHeight()-height)/2,width,height});}
 pdf.setTitle('Alpha scan');pdf.setCreator('Alpha Phone');
 const bytes=new Uint8Array(await pdf.save());signal.throwIfAborted();if(bytes.length>8*1024*1024)throw Error('PDF exceeds the 8 MB export limit.');return bytes;
}
export class ScanPdfExportError extends Error {}
export async function exportScanPdf(image:Blob|Blob[],signal:AbortSignal,title:string){
 const bytes=await createScanPdf(image,signal);let raw='';for(let index=0;index<bytes.length;index+=16384)raw+=String.fromCharCode(...bytes.subarray(index,index+16384));
 signal.throwIfAborted();try{return await documents.exportPdf({title,dataBase64:btoa(raw)});}catch(error){throw new ScanPdfExportError('PDF export unconfirmed.',{cause:error});}
}
