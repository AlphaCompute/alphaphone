import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
// Real consumer request/callback methods against a JVM model of Capacitor's plugin-ID queues.
// This reproduces callback ownership; it does not establish real Android permission acceptance.
function method(source,signature){const start=source.indexOf(signature);assert.notEqual(start,-1,signature);let end=source.indexOf('{',start),depth=1;for(end++;depth;end++){if(source[end]==='{')depth++;if(source[end]==='}')depth--;}return source.slice(start,end);}
test('photo permission facade receives its own callback after full, selected and denied grants',()=>{
 const facade=readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaPhotoLibraryPlugin.java','utf8');
 const photos=readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaPhotosPlugin.java','utf8');
 const capacitor=readFileSync('node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/Plugin.java','utf8');
 const bridge=readFileSync('node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/Bridge.java','utf8');
 assert.match(capacitor,/PluginCall savedCall = bridge\.getPermissionCall\(handle\.getId\(\)\)/);
 assert.match(bridge,/savedPermissionCallIds\.get\(call\.getPluginId\(\)\)\.add\(call\.getCallbackId\(\)\)/);
 const permissionRows=source=>[...source.matchAll(/@Permission\(alias="([^"]+)",strings=\{"([^"]+)"\}\)/g)].map(row=>row.slice(1));
 assert.deepEqual(permissionRows(facade),permissionRows(photos),'both entrypoints declare the same real Android grants');
 const body=`
import java.util.*;
@interface PluginMethod {} @interface PermissionCallback {}
class Build {static class VERSION {static int SDK_INT;}}
class PluginCall {final String pluginId;int resolves,rejects;Map<String,String> result;PluginCall(String id){pluginId=id;}void resolve(Map<String,String> value){resolves++;result=value;}void reject(String error){rejects++;}}
class Activity {boolean focused=true;boolean hasWindowFocus(){return focused;}}
class Catalog {String scope="denied";int invalidations,reads;void invalidate(){invalidations++;}}
class Bridge {
 final Map<String,ArrayDeque<PluginCall>> queues=new HashMap<>();String[] requested;
 void savePermissionCall(PluginCall call){queues.computeIfAbsent(call.pluginId,key->new ArrayDeque<>()).add(call);}
 void complete(Plugin plugin)throws Exception {ArrayDeque<PluginCall> q=queues.get(plugin.id);PluginCall call=q==null?null:q.poll();if(call==null)return;var callback=plugin.getClass().getDeclaredMethod("libraryPermissionResult",PluginCall.class);callback.setAccessible(true);callback.invoke(plugin,call);}
}
class Plugin {final String id;final Bridge bridge;final Activity activity=new Activity();Plugin(String id,Bridge bridge){this.id=id;this.bridge=bridge;}Activity getActivity(){return activity;}void requestPermissionForAliases(String[] aliases,PluginCall call,String callback){bridge.requested=aliases;bridge.savePermissionCall(call);}public void requestPermissions(PluginCall call){throw new AssertionError("Do not request all API-level aliases");}}
class LateLaunch {static void ask(PluginCall call,Runnable request){request.run();}}
class AlphaPhotosPlugin extends Plugin {
 AlphaPhotosPlugin(Bridge bridge){super("AlphaPhotos",bridge);}
 ${method(photos,'static String[] libraryPermissionAliases()')}
 void requestLibraryAccess(PluginCall call){requestPermissionForAliases(libraryPermissionAliases(),call,"libraryPermissionResult");}
 private void libraryPermissionResult(PluginCall call){call.resolve(Map.of("scope","full"));}
}
class AlphaPhotoLibraryPlugin extends Plugin {
 boolean destroyed;final Catalog catalog=new Catalog();AlphaPhotoLibraryPlugin(Bridge bridge){super("AlphaPhotoLibrary",bridge);}
 Map<String,String> scopeResult(){return Map.of("scope",catalog.scope);}
 ${method(facade,'@PluginMethod public void requestAccess(PluginCall call)')}
 ${method(facade,'@PermissionCallback private void libraryPermissionResult(PluginCall call)')}
 ${method(facade,'@Override @PluginMethod public void requestPermissions(PluginCall call)')}
}
public class PermissionOwnerHarness {
 static void check(boolean value){if(!value)throw new AssertionError();}
 public static void main(String[] args)throws Exception {
  Bridge old=new Bridge();PluginCall lost=new PluginCall("AlphaPhotoLibrary");AlphaPhotosPlugin delegate=new AlphaPhotosPlugin(old);delegate.requestLibraryAccess(lost);old.complete(delegate);check(lost.resolves==0&&old.queues.get("AlphaPhotoLibrary").size()==1);
  for(int sdk:new int[]{32,33,34,36})for(String scope:new String[]{"full","selected","denied"})for(boolean inherited:new boolean[]{false,true}){
   Build.VERSION.SDK_INT=sdk;Bridge bridge=new Bridge();AlphaPhotoLibraryPlugin library=new AlphaPhotoLibraryPlugin(bridge);PluginCall call=new PluginCall("AlphaPhotoLibrary");
   if(inherited)library.requestPermissions(call);else library.requestAccess(call);check(call.resolves==0&&call.rejects==0);
   String[] expected=sdk>=34?new String[]{"libraryImages","libraryVideos","librarySelected"}:sdk>=33?new String[]{"libraryImages","libraryVideos"}:new String[]{"libraryLegacy"};check(Arrays.equals(bridge.requested,expected));
   library.catalog.scope=scope;bridge.complete(library);check(call.resolves==1&&call.rejects==0&&call.result.get("scope").equals(scope)&&library.catalog.invalidations==1&&library.catalog.reads==0);check(bridge.queues.get("AlphaPhotoLibrary").isEmpty());
  }
  Bridge bridge=new Bridge();AlphaPhotoLibraryPlugin library=new AlphaPhotoLibraryPlugin(bridge);library.activity.focused=false;PluginCall late=new PluginCall("AlphaPhotoLibrary");library.requestAccess(late);check(late.rejects==1&&bridge.requested==null);
  library.activity.focused=true;library.destroyed=true;PluginCall closed=new PluginCall("AlphaPhotoLibrary");library.requestAccess(closed);check(closed.rejects==1&&bridge.requested==null);
  library.destroyed=false;PluginCall interrupted=new PluginCall("AlphaPhotoLibrary");library.requestAccess(interrupted);library.destroyed=true;bridge.complete(library);check(interrupted.rejects==1&&interrupted.resolves==0&&library.catalog.invalidations==0);
  System.out.println("PASS permission owner, OS aliases, scope readback, no data read and foreground guards");
 }
}`;
 const dir=mkdtempSync(join(tmpdir(),'alpha-photo-permission-owner-'));
 try{const file=join(dir,'PermissionOwnerHarness.java');writeFileSync(file,body);const bin=name=>process.env.JAVA_HOME?join(process.env.JAVA_HOME,'bin',name):name;execFileSync(bin('javac'),['--release','11','-d',dir,file],{stdio:'pipe'});assert.match(execFileSync(bin('java'),['-cp',dir,'PermissionOwnerHarness'],{encoding:'utf8'}),/PASS permission owner/);}finally{rmSync(dir,{recursive:true,force:true});}
});
