import test from 'node:test';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

test('PDF export validates bounded encoding and detects provider truncation, mutation and extra bytes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'alpha-pdf-'));
 try{
  const harness=join(dir,'PdfExportHarness.java');writeFileSync(harness,`package ai.elizaresearch.alphaphone;
import java.io.*;import java.util.*;
public class PdfExportHarness {
 interface Check {void run()throws Exception;}
 static void reject(Check check)throws Exception{boolean rejected=false;try{check.run();}catch(IllegalArgumentException|IOException expected){rejected=true;}if(!rejected)throw new AssertionError("Expected rejection");}
 public static void main(String[] args)throws Exception{
  byte[] bytes="%PDF-1.7\\nreal export bytes\\n%%EOF".getBytes("UTF-8");String encoded=Base64.getEncoder().encodeToString(bytes);
  if(!Arrays.equals(bytes,DocumentExportBytes.pdf(encoded)))throw new AssertionError();
  for(String value:new String[]{null,"","broken",encoded+"!",Base64.getEncoder().encodeToString("not a pdf".getBytes("UTF-8"))})reject(()->DocumentExportBytes.pdf(value));
  reject(()->DocumentExportBytes.pdf("A".repeat(11184816)));
  DocumentExportBytes.verify(new ByteArrayInputStream(bytes),bytes);
  reject(()->DocumentExportBytes.verify(new ByteArrayInputStream(Arrays.copyOf(bytes,bytes.length-1)),bytes));
  reject(()->DocumentExportBytes.verify(new ByteArrayInputStream(Arrays.copyOf(bytes,bytes.length+1)),bytes));
  byte[] changed=bytes.clone();changed[9]^=1;reject(()->DocumentExportBytes.verify(new ByteArrayInputStream(changed),bytes));
  reject(()->DocumentExportBytes.verify(null,bytes));
  reject(()->DocumentExportBytes.verify(new InputStream(){public int read(){return -1;}public int read(byte[] b){return 0;}},bytes));
 }
}`);
  const binary=name=>process.env.JAVA_HOME?join(process.env.JAVA_HOME,'bin',name):name;
  execFileSync(binary('javac'),['--release','11','-d',dir,'android/app/src/main/java/ai/elizaresearch/alphaphone/DocumentExportBytes.java',harness],{timeout:20000});
  execFileSync(binary('java'),['-cp',dir,'ai.elizaresearch.alphaphone.PdfExportHarness'],{timeout:10000});
 }finally{rmSync(dir,{recursive:true,force:true});}
});
