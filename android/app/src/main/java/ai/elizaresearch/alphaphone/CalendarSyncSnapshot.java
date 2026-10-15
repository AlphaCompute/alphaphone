package ai.elizaresearch.alphaphone;

import android.content.ContentProviderOperation;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;

/** Exact owned-source provider snapshot for the native sync bridge. No permission, owner,
 * consent, write or deletion authority is created here. Callers must admit those separately.
 * Unlike the Calendar view, this never queries Instances or infers deletion from a date range. */
final class CalendarSyncSnapshot {
 private static final String[] SOURCE={"_id","account_name","account_type","name","calendar_access_level","ownerAccount","cal_sync1"};
 private static final String[] EVENT={"_id","calendar_id","title","description","eventLocation","dtstart","dtend","duration","eventTimezone","eventEndTimezone","allDay","rrule","rdate","exrule","exdate","original_id","original_sync_id","originalInstanceTime","originalAllDay","eventStatus","deleted","hasAlarm","hasAttendeeData","availability","accessLevel","organizer","_sync_id","selfAttendeeStatus","guestsCanModify","guestsCanInviteOthers","guestsCanSeeGuests","customAppPackage","customAppUri"};
 private static final String[] ATTENDEE={"_id","event_id","attendeeName","attendeeEmail","attendeeRelationship","attendeeType","attendeeStatus","attendeeIdentity","attendeeIdNamespace"};
 private static final String[] REMINDER={"_id","event_id","minutes","method"};
 private static final String[] PROPERTY={"_id","event_id","name","value"};
 private static final int MAX_ROWS=2048,MAX_BYTES=1024*1024;
 final long calendarId,eventId;
 final String generation,sourceRevision,revision;
 final boolean missing,deleted;
 private final ContentValues source;
 private final List<ContentValues> family,attendees,reminders,properties;
 private final String familyWhere,childWhere;
 private final String[] familyArgs,childArgs;

 private CalendarSyncSnapshot(ContentResolver resolver,long calendarId,long eventId,String account,String name,String generation)throws Exception{
  if(calendarId<=0||eventId<=0||account==null||account.isEmpty()||name==null||name.isEmpty()||generation==null||!generation.matches("[a-f0-9-]{36}"))throw new IllegalArgumentException("Invalid Calendar sync source");
  this.calendarId=calendarId;this.eventId=eventId;this.generation=generation;
  List<ContentValues> sources=rows(resolver,ContentUris.withAppendedId(CalendarContract.Calendars.CONTENT_URI,calendarId),SOURCE,null,null,1);
  if(sources.size()!=1)throw new IllegalStateException("Owned Calendar source is unavailable");
  source=sources.get(0);
  if(number(source,"_id")!=calendarId||!account.equals(source.getAsString("account_name"))||!CalendarContract.ACCOUNT_TYPE_LOCAL.equals(source.getAsString("account_type"))||!name.equals(source.getAsString("name"))||!generation.equals(source.getAsString("cal_sync1"))||number(source,"calendar_access_level")<CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR)throw new SecurityException("Calendar sync source changed");
  sourceRevision=digest(canonical(SOURCE,List.of(source)));
  List<ContentValues> exact=rows(resolver,ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI,eventId),EVENT,null,null,1);
  if(!exact.isEmpty()&&number(exact.get(0),"calendar_id")!=calendarId)throw new SecurityException("Calendar event moved to another source");
  familyWhere="calendar_id=? AND (_id=? OR original_id=?)";
  familyArgs=new String[]{Long.toString(calendarId),Long.toString(eventId),Long.toString(eventId)};
  family=rows(resolver,CalendarContract.Events.CONTENT_URI,EVENT,familyWhere,familyArgs,MAX_ROWS);
  ContentValues parent=null;
  for(ContentValues row:family){if(number(row,"calendar_id")!=calendarId)throw new IllegalStateException("Foreign Calendar row");if(number(row,"_id")==eventId){if(parent!=null)throw new IllegalStateException("Ambiguous Calendar event");parent=row;}}
  // A child of an absent parent is an inconsistent family, not a deletion receipt.
  if((parent==null)!=exact.isEmpty())throw new IllegalStateException("Calendar changed during snapshot");
  if(parent==null&&!family.isEmpty())throw new IllegalStateException("Calendar family needs recovery");
  if(parent!=null&&(parent.get("original_id")!=null||!empty(parent,"original_sync_id")))throw new UnsupportedOperationException("Sync the parent series rather than an exception");
  missing=parent==null;deleted=parent!=null&&number(parent,"deleted")!=0;
  StringBuilder ids=new StringBuilder();for(ContentValues row:family){long id=number(row,"_id");if(id<=0)throw new IllegalStateException("Invalid Calendar event identity");if(ids.length()>0)ids.append(',');ids.append(id);}
  // The absent event ID is still asserted: a concurrent insert or child-row addition must fail CAS.
  childWhere=family.isEmpty()?"event_id=?":"event_id IN ("+ids+")";
  childArgs=family.isEmpty()?new String[]{Long.toString(eventId)}:null;
  attendees=rows(resolver,CalendarContract.Attendees.CONTENT_URI,ATTENDEE,childWhere,childArgs,MAX_ROWS);
  reminders=rows(resolver,CalendarContract.Reminders.CONTENT_URI,REMINDER,childWhere,childArgs,MAX_ROWS);
  properties=rows(resolver,CalendarContract.ExtendedProperties.CONTENT_URI,PROPERTY,childWhere,childArgs,MAX_ROWS);
  if(missing&&(!attendees.isEmpty()||!reminders.isEmpty()||!properties.isEmpty()))throw new IllegalStateException("Orphan Calendar child rows need recovery");
  String value=sourceRevision+":"+eventId+":"+canonical(EVENT,family)+canonical(ATTENDEE,attendees)+canonical(REMINDER,reminders)+canonical(PROPERTY,properties);
  if(value.getBytes(StandardCharsets.UTF_8).length>MAX_BYTES)throw new IllegalStateException("Calendar sync snapshot is too large");
  revision=digest(value);
 }
 static CalendarSyncSnapshot read(ContentResolver resolver,long calendarId,long eventId,String account,String localName,String generation)throws Exception{
  return new CalendarSyncSnapshot(resolver,calendarId,eventId,account,localName,generation);
 }
 /** All dependent rows and their counts belong in the same CalendarProvider applyBatch as
  * a permitted mutation. Never yield the transaction. Nothing in this method dispatches it. */
 ArrayList<ContentProviderOperation> assertions(){
  ArrayList<ContentProviderOperation> result=new ArrayList<>();
  result.add(ContentProviderOperation.newAssertQuery(ContentUris.withAppendedId(CalendarContract.Calendars.CONTENT_URI,calendarId)).withValues(source).withExpectedCount(1).build());
  result.add(ContentProviderOperation.newAssertQuery(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI,eventId)).withExpectedCount(missing?0:1).build());
  assertRows(result,CalendarContract.Events.CONTENT_URI,family,familyWhere,familyArgs);
  assertRows(result,CalendarContract.Attendees.CONTENT_URI,attendees,childWhere,childArgs);
  assertRows(result,CalendarContract.Reminders.CONTENT_URI,reminders,childWhere,childArgs);
  assertRows(result,CalendarContract.ExtendedProperties.CONTENT_URI,properties,childWhere,childArgs);
  return result;
 }
 private static void assertRows(ArrayList<ContentProviderOperation> out,Uri uri,List<ContentValues> rows,String where,String[] args){
  out.add(ContentProviderOperation.newAssertQuery(uri).withSelection(where,args).withExpectedCount(rows.size()).build());
  for(ContentValues row:rows)out.add(ContentProviderOperation.newAssertQuery(ContentUris.withAppendedId(uri,number(row,"_id"))).withValues(row).withExpectedCount(1).build());
 }
 private static List<ContentValues> rows(ContentResolver resolver,Uri uri,String[] fields,String where,String[] args,int maximum){
  List<ContentValues> values=new ArrayList<>();int bytes=0;
  try(Cursor cursor=resolver.query(uri,fields,where,args,"_id ASC")){
   if(cursor==null)throw new IllegalStateException("Calendar provider read is unavailable");
   while(cursor.moveToNext()){
    if(values.size()>=maximum)throw new IllegalStateException("Calendar sync snapshot has too many rows");
    ContentValues row=new ContentValues();
    for(int i=0;i<fields.length;i++){
     if(cursor.isNull(i))row.putNull(fields[i]);
     else if(cursor.getType(i)==Cursor.FIELD_TYPE_INTEGER)row.put(fields[i],cursor.getLong(i));
     else{String text=cursor.getString(i);bytes+=text.getBytes(StandardCharsets.UTF_8).length;if(bytes>MAX_BYTES)throw new IllegalStateException("Calendar sync snapshot is too large");row.put(fields[i],text);}
    }
    values.add(row);
   }
  }
  return values;
 }
 private static long number(ContentValues row,String field){Long value=row.getAsLong(field);return value==null?0:value;}
 private static boolean empty(ContentValues row,String field){String value=row.getAsString(field);return value==null||value.isEmpty();}
 private static String canonical(String[] fields,List<ContentValues> rows){StringBuilder value=new StringBuilder();value.append(rows.size()).append(';');for(ContentValues row:rows)for(String field:fields){String text=row.getAsString(field);value.append(field.length()).append(':').append(field).append(text==null?"N":"V"+text.length()+":"+text).append(';');}return value.toString();}
 private static String digest(String input)throws Exception{byte[] bytes=MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8));StringBuilder value=new StringBuilder();for(byte b:bytes)value.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return value.toString();}
}
