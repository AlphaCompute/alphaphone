import { WebPlugin } from '@capacitor/core';

/** User-selected local text only. The browser never uploads the chosen file. */
export class BrowserNoteDocuments extends WebPlugin {
  async importText(): Promise<{ status: string; message: string; name?: string; text?: string }> {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.txt,.md,.markdown,text/plain,text/markdown';
      input.hidden = true;
      document.body.append(input);
      let settled = false;
      const finish = (result: { status: string; message: string; name?: string; text?: string }) => {
        if (settled) return;
        settled = true;
        input.remove();
        resolve(result);
      };
      input.addEventListener('cancel', () => finish({ status: 'cancelled', message: 'No file imported.' }), { once: true });
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return finish({ status: 'cancelled', message: 'No file imported.' });
        if (file.size > 2 * 1024 * 1024) return finish({ status: 'failed', message: 'Choose a text file smaller than 2 MB.' });
        try {
          const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer());
          if (text.includes('\0')) throw new Error('Binary file');
          finish({ status: 'read', message: 'Local text selected.', name: file.name, text });
        } catch {
          finish({ status: 'failed', message: 'Choose a valid UTF-8 text file. Nothing imported.' });
        }
      }, { once: true });
      input.click();
    });
  }

  async exportPdf({title,dataBase64}:{title:string;dataBase64:string}) {
    if(typeof dataBase64!=='string'||dataBase64.length>11184812||!dataBase64.length||dataBase64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(dataBase64))throw Error('Invalid PDF export.');
    const raw=atob(dataBase64);if(raw.length>8*1024*1024||!raw.startsWith('%PDF-'))throw Error('Invalid PDF export.');
    const url=URL.createObjectURL(new Blob([Uint8Array.from(raw,char=>char.charCodeAt(0))],{type:'application/pdf'}));
    const link=document.createElement('a');link.href=url;link.download=(String(title).replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,100)||'Alpha scan')+'.pdf';
    try{document.body.append(link);link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
    return {status:'requested',message:'PDF download requested. Check your browser downloads.'};
  }

  async exportText({ title, text }: { title: string; text: string }) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = (title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 160) || 'Note') + '.txt';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { status: 'requested', message: 'Download requested. Check your browser downloads.' };
  }
}
