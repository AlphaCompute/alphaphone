/** Pixel fallback for the product's CSS color filters on canvases without filter support. */
export function applyPhotoFilter(context:CanvasRenderingContext2D,width:number,height:number,filter:string){
 if(filter==='none')return;
 type Transform=(r:number,g:number,b:number)=>number[];
 const transforms:Transform[]=[];
 for(const match of filter.matchAll(/([a-z-]+)\(([-.\d]+)(deg)?\)/g)){
  const kind=match[1],n=Number(match[2]);
  if(kind==='brightness')transforms.push((r,g,b)=>[r*n,g*n,b*n]);
  else if(kind==='contrast')transforms.push((r,g,b)=>[r*n+127.5*(1-n),g*n+127.5*(1-n),b*n+127.5*(1-n)]);
  else if(kind==='saturate'||kind==='grayscale'){const s=kind==='grayscale'?1-n:n;transforms.push((r,g,b)=>{const l=.2126*r+.7152*g+.0722*b;return [l+(r-l)*s,l+(g-l)*s,l+(b-l)*s];});}
  else if(kind==='sepia')transforms.push((r,g,b)=>[r*(1-n)+n*(.393*r+.769*g+.189*b),g*(1-n)+n*(.349*r+.686*g+.168*b),b*(1-n)+n*(.272*r+.534*g+.131*b)]);
  else if(kind==='hue-rotate'){const c=Math.cos(n*Math.PI/180),s=Math.sin(n*Math.PI/180);transforms.push((r,g,b)=>[
   (.213+.787*c-.213*s)*r+(.715-.715*c-.715*s)*g+(.072-.072*c+.928*s)*b,
   (.213-.213*c+.143*s)*r+(.715+.285*c+.140*s)*g+(.072-.072*c-.283*s)*b,
   (.213-.213*c-.787*s)*r+(.715-.715*c+.715*s)*g+(.072+.928*c+.072*s)*b]);}
  else throw Error('Unknown photo filter.');
 }
 if(!transforms.length)throw Error('Invalid photo filter.');
 const image=context.getImageData(0,0,width,height),pixels=image.data;
 for(let i=0;i<pixels.length;i+=4){let r=pixels[i],g=pixels[i+1],b=pixels[i+2];for(const transform of transforms){const value=transform(r,g,b);r=Math.max(0,Math.min(255,value[0]));g=Math.max(0,Math.min(255,value[1]));b=Math.max(0,Math.min(255,value[2]));}pixels[i]=r;pixels[i+1]=g;pixels[i+2]=b;}
 context.putImageData(image,0,0);
}
