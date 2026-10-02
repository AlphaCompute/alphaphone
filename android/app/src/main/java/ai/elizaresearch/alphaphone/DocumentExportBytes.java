package ai.elizaresearch.alphaphone;

import java.io.IOException;
import java.io.InputStream;
import java.util.Base64;

/** Bounded export payload and exact provider readback; independent of Android UI. */
final class DocumentExportBytes {
 static final int PDF_LIMIT=8*1024*1024;
 static byte[] pdf(String encoded){
  if(encoded==null||encoded.isEmpty()||encoded.length()>11184812||encoded.length()%4!=0)throw new IllegalArgumentException("Invalid PDF payload");
  byte[] content=Base64.getDecoder().decode(encoded);
  if(content.length<5||content.length>PDF_LIMIT||content[0]!='%'||content[1]!='P'||content[2]!='D'||content[3]!='F'||content[4]!='-')throw new IllegalArgumentException("Invalid PDF payload");
  return content;
 }
 static void verify(InputStream in,byte[] expected)throws IOException{
  if(in==null)throw new IOException("Missing readback");int offset=0;byte[] buffer=new byte[8192];int count;
  while((count=in.read(buffer))!=-1){
   if(count==0)throw new IOException("Readback made no progress");
   if(offset+count>expected.length)throw new IOException("Readback size changed");
   for(int index=0;index<count;index++)if(buffer[index]!=expected[offset+index])throw new IOException("Readback bytes changed");
   offset+=count;
  }
  if(offset!=expected.length)throw new IOException("Incomplete readback");
 }
 private DocumentExportBytes(){}
}
