package ai.elizaresearch.alphaphone;

import java.util.ArrayList;
import java.util.List;
import java.util.TreeSet;

/**
 * The pure parts of the Clock handoff contract. Repeat days use java.util.Calendar values
 * (SUNDAY=1 … SATURDAY=7). No Android or Capacitor types: host-tested by javac.
 */
final class ClockContract {
 private ClockContract(){}
 /** Alpha's own Clock form (DailyApps.clockHandoff): 1 to 7 days, unique and ascending. */
 static ArrayList<Integer> strictDays(Object raw){
  if(raw==null||raw==org.json.JSONObject.NULL)return null;
  if(!(raw instanceof org.json.JSONArray))throw new IllegalArgumentException("Choose valid repeat days");
  org.json.JSONArray input=(org.json.JSONArray)raw;
  if(input.length()<1||input.length()>7)throw new IllegalArgumentException("Choose valid repeat days");
  ArrayList<Integer> out=new ArrayList<>();
  for(int i=0;i<input.length();i++)out.add(day(input.opt(i)));
  return strictDays(out);
 }
 static ArrayList<Integer> strictDays(List<Integer> input){
  if(input==null)return null;
  ArrayList<Integer> out=new ArrayList<>();
  for(Integer day:input){if(day==null||day<1||day>7||(!out.isEmpty()&&day<=out.get(out.size()-1)))throw new IllegalArgumentException("Choose valid repeat days");out.add(day);}
  if(out.isEmpty())throw new IllegalArgumentException("Choose valid repeat days");
  return out;
 }
 /**
  * An agent operation's days, as the pinned upstream clock-contract.ts (clockDays) admits them:
  * at most seven, any order. They are sorted and de-duplicated. An explicit empty list is a
  * one-time alarm and returns null, the same as omitted days.
  */
 static ArrayList<Integer> agentDays(Object raw){
  if(raw==null||raw==org.json.JSONObject.NULL)return null;
  if(!(raw instanceof org.json.JSONArray))throw new IllegalArgumentException("Choose valid repeat days");
  org.json.JSONArray input=(org.json.JSONArray)raw;
  if(input.length()>7)throw new IllegalArgumentException("Choose valid repeat days");
  TreeSet<Integer> days=new TreeSet<>();
  for(int i=0;i<input.length();i++)days.add(day(input.opt(i)));
  return days.isEmpty()?null:new ArrayList<>(days);
 }
 private static int day(Object value){
  if(!(value instanceof Number))throw new IllegalArgumentException("Choose valid repeat days");
  double n=((Number)value).doubleValue();
  if(!Double.isFinite(n)||n!=Math.rint(n)||n<1||n>7)throw new IllegalArgumentException("Choose valid repeat days");
  return (int)n;
 }
 /**
  * The package that receives a Clock handoff, or null when it must not be sent: nothing resolved,
  * or the handler is Alpha itself (a launcher-flavor HOME holder or a future Alpha Clock).
  */
 static String receiver(String ownPackage,String resolvedPackage){
  if(resolvedPackage==null||resolvedPackage.isEmpty()||resolvedPackage.equals(ownPackage))return null;
  return resolvedPackage;
 }
}
