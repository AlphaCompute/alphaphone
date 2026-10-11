package ai.elizaresearch.alphaphone;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The Calendar view's bounded read of CalendarProvider instances. The shared upstream reader
 * returns every instance in a range; one read here hands the renderer at most
 * {@link #MAXIMUM_EVENTS} and says when the provider held more, so the view can show
 * "Calendar results incomplete" and never call a date it did not receive free. Rows have the
 * shared reader's shape and order. Hosts own permission and presentation.
 */
final class CalendarRangeReader {
 /** Most instances one range read returns (docs/calendar-range-and-text-size.md). */
 static final int MAXIMUM_EVENTS=2000;
 static final long MAXIMUM_RANGE=370L*86400000L;
 private CalendarRangeReader(){}
 /** {"events":[…],"truncated":bool}: the first MAXIMUM_EVENTS non-deleted instances by start. */
 static JSONObject read(ContentResolver resolver,long begin,long end)throws JSONException{
  if(begin<0||end<=begin||end-begin>MAXIMUM_RANGE)throw new IllegalArgumentException("A valid calendar range of at most 370 days is required");
  Uri.Builder range=CalendarContract.Instances.CONTENT_URI.buildUpon();ContentUris.appendId(range,begin);ContentUris.appendId(range,end);
  String[] fields={CalendarContract.Instances.EVENT_ID,CalendarContract.Instances.CALENDAR_ID,CalendarContract.Instances.TITLE,CalendarContract.Instances.DESCRIPTION,CalendarContract.Instances.EVENT_LOCATION,
   CalendarContract.Instances.BEGIN,CalendarContract.Instances.END,CalendarContract.Instances.ALL_DAY,CalendarContract.Instances.RRULE};
  JSONArray events=new JSONArray();boolean truncated=false;
  try(Cursor rows=resolver.query(range.build(),fields,CalendarContract.Events.DELETED+"=0",null,CalendarContract.Instances.BEGIN+" ASC")){
   if(rows==null)throw new IllegalStateException("Calendar provider returned no cursor");
   while(rows.moveToNext()){
    // One row past the bound proves the result is incomplete; nothing after it is read.
    if(events.length()==MAXIMUM_EVENTS){truncated=true;break;}
    String recurrence=rows.getString(8);
    events.put(new JSONObject().put("id",Long.toString(rows.getLong(0))).put("calendarId",Long.toString(rows.getLong(1)))
     .put("title",rows.getString(2)).put("body",rows.getString(3)).put("location",rows.getString(4))
     .put("begin",rows.getLong(5)).put("end",rows.getLong(6)).put("allDay",rows.getInt(7)!=0)
     .put("recurring",recurrence!=null&&!recurrence.isEmpty()));
   }
  }
  return new JSONObject().put("events",events).put("truncated",truncated);
 }
}
