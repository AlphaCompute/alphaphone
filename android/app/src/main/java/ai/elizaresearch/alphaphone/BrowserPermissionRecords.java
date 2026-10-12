package ai.elizaresearch.alphaphone;

import ai.eliza.plugins.browsersurface.BrowserSitePermissions;
import java.util.LinkedHashMap;
import java.util.Map;
import org.json.JSONObject;
import org.json.JSONTokener;

/**
 * Alpha's sealed website-permission record, read and written through upstream
 * BrowserSitePermissions, which owns the decision rules (persistent profile only, a private tab
 * always asks, at most 200 origins with the oldest dropped first, clearing a site and its
 * subdomains). The stored format is unchanged: {"https://host[:port]":{"camera":true,...}},
 * oldest origin first, so records written before this class are read as they are. An origin or
 * kind upstream does not recognize grants nothing and is dropped; a damaged record grants nothing
 * and every site is asked again. No Android types: host-tested by javac.
 */
final class BrowserPermissionRecords {
 private BrowserPermissionRecords(){}
 /** Decisions from the decrypted record, in stored order. Null or damaged reads as empty. */
 static BrowserSitePermissions read(String json){
  if(json==null)return BrowserSitePermissions.restore(null);
  try{return BrowserSitePermissions.restore(ordered(json));}
  catch(Exception damaged){return BrowserSitePermissions.restore(null);}
 }
 /** org.json objects need not keep key order; the bound depends on it, so parse in order. */
 private static Map<String,Map<String,Boolean>> ordered(String json)throws Exception{
  JSONTokener tokens=new JSONTokener(json);
  if(tokens.nextClean()!='{')throw new IllegalArgumentException();
  LinkedHashMap<String,Map<String,Boolean>> sites=new LinkedHashMap<>();
  if(tokens.nextClean()=='}')return endOfRecord(tokens,sites);
  tokens.back();
  while(true){
   Object origin=tokens.nextValue();
   if(!(origin instanceof String)||tokens.nextClean()!=':')throw new IllegalArgumentException();
   Object value=tokens.nextValue();
   if(value instanceof JSONObject){
    JSONObject site=(JSONObject)value;LinkedHashMap<String,Boolean> decisions=new LinkedHashMap<>();
    for(String kind:BrowserSitePermissions.KINDS)if(site.opt(kind) instanceof Boolean)decisions.put(kind,(Boolean)site.get(kind));
    sites.remove(origin);sites.put((String)origin,decisions);
   }
   char next=tokens.nextClean();
   if(next=='}')return endOfRecord(tokens,sites);
   if(next!=',')throw new IllegalArgumentException();
  }
 }
 private static Map<String,Map<String,Boolean>> endOfRecord(JSONTokener tokens,Map<String,Map<String,Boolean>> sites){
  if(tokens.nextClean()!=0)throw new IllegalArgumentException();
  return sites;
 }
 /** The record to seal, oldest origin first. */
 static String write(BrowserSitePermissions permissions)throws Exception{
  StringBuilder out=new StringBuilder("{");
  for(Map.Entry<String,Map<String,Boolean>> site:permissions.snapshot().entrySet()){
   if(out.length()>1)out.append(',');
   out.append(JSONObject.quote(site.getKey())).append(':').append(new JSONObject(site.getValue()).toString());
  }
  return out.append('}').toString();
 }
}
