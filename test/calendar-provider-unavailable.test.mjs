import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
test('the production Calendar cursor reader distinguishes unavailable from a confirmed empty result',()=>{
 const source=readFileSync(new URL('../android/app/src/main/java/ai/elizaresearch/alphaphone/CalendarDeferredDeletion.java',import.meta.url),'utf8');
 const method=source.slice(source.indexOf(' private static ContentValues values('),source.indexOf(' private static void append(')).replace('android.net.Uri','String');
 const dir=mkdtempSync(join(tmpdir(),'alpha-calendar-cursor-'));
 const java=name=>process.env.JAVA_HOME?join(process.env.JAVA_HOME,'bin',name):name;
 try{
  writeFileSync(join(dir,'CalendarCursorTest.java'),`public class CalendarCursorTest {
   static class Cursor implements AutoCloseable { static final int FIELD_TYPE_INTEGER=1; public void close(){} boolean moveToFirst(){return false;} boolean moveToNext(){return false;} boolean isNull(int i){return false;} int getType(int i){return 1;} long getLong(int i){return 0;} String getString(int i){return "";} }
   static class ContentValues { void putNull(String k){} void put(String k,long v){} void put(String k,String v){} }
   static class ContentResolver { Cursor cursor; Cursor query(String uri,String[] f,Object a,Object b,Object c){return cursor;} }
   ${method}
   public static void main(String[] args) {
    ContentResolver resolver=new ContentResolver();boolean refused=false;
    try{values(resolver,"events",new String[0]);}catch(IllegalStateException unavailable){refused=true;}
    if(!refused)throw new AssertionError("null cursor reported absent");
    resolver.cursor=new Cursor();if(values(resolver,"events",new String[0])!=null)throw new AssertionError("empty result not absent");
    System.out.println("PASS unavailable is not absence");
   }
  }`);
  execFileSync(java('javac'),['--release','11','-d',dir,join(dir,'CalendarCursorTest.java')],{timeout:60000});
  assert.match(execFileSync(java('java'),['-cp',dir,'CalendarCursorTest'],{encoding:'utf8',timeout:15000}),/PASS unavailable is not absence/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
