package ai.elizaresearch.alphaphone;

import android.Manifest;
import ai.eliza.plugins.calendar.CalendarConfiguration;
import ai.eliza.plugins.calendar.CalendarPlugin;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

/** Product registration only. These identities preserve existing provider rows and receipts. */
@CapacitorPlugin(name="AlphaCalendar", permissions={
 @Permission(alias="calendar",strings={Manifest.permission.READ_CALENDAR,Manifest.permission.WRITE_CALENDAR}),
 @Permission(alias="workflowCalendarRead",strings={Manifest.permission.READ_CALENDAR})
})
public final class AlphaCalendarPlugin extends CalendarPlugin {
 static final CalendarConfiguration CONFIGURATION=new CalendarConfiguration(
  "Alpha Phone","alpha-phone-local","On this phone","alpha-calendar-creations-v1",
  "alphaphone://calendar-creation/",0xff0000ff);
 public AlphaCalendarPlugin(){super(CONFIGURATION);}
}
