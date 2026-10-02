export type CameraTransform={zoom:number;mirror:boolean};
/** The same centered sensor crop is used for saved photos and encoded video. */
export function drawCameraFrame(video:HTMLVideoElement,transform:CameraTransform,canvas=document.createElement('canvas')){
 const {zoom,mirror}=transform,width=video.videoWidth,height=video.videoHeight;
 if(!Number.isFinite(zoom)||zoom<1||zoom>8)throw Error('Digital zoom must be between 1× and 8×.');
 if(width<=0||height<=0||width*height>32_000_000)throw Error('Unsupported camera dimensions.');
 if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
 const context=canvas.getContext('2d');if(!context)throw Error('Camera encoding is unavailable.');
 context.save();context.clearRect(0,0,width,height);if(mirror){context.translate(width,0);context.scale(-1,1);}
 const croppedWidth=width/zoom,croppedHeight=height/zoom;
 context.drawImage(video,(width-croppedWidth)/2,(height-croppedHeight)/2,croppedWidth,croppedHeight,0,0,width,height);context.restore();return canvas;
}
