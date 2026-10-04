package ai.elizaresearch.alphaphone;

import android.Manifest;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import ai.eliza.plugins.calendar.CalendarConfiguration;
import ai.eliza.plugins.calendar.CalendarPlugin;

/** Keep installed calendar/journal identity stable while sharing provider behavior. */
@CapacitorPlugin(name="AlphaCalendar", permissions={@Permission(alias="calendar",strings={Manifest.permission.READ_CALENDAR,Manifest.permission.WRITE_CALENDAR}),@Permission(alias="workflowCalendarRead",strings={Manifest.permission.READ_CALENDAR})})
public final class AlphaCalendarPlugin extends CalendarPlugin {
 static final CalendarConfiguration CONFIGURATION=new CalendarConfiguration(
  "Alpha Phone","alpha-phone-local","On this phone","alpha-calendar-creations-v1","alphaphone://calendar-creation/",0xff0000ff);
 public AlphaCalendarPlugin(){super(CONFIGURATION);}
}
