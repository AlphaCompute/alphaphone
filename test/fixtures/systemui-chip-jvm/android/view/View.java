package android.view;
import android.content.Context;
import android.graphics.Rect;
public class View {
 public static final int VISIBLE=0,INVISIBLE=4,GONE=8,ACCESSIBILITY_LIVE_REGION_POLITE=1;
 public interface OnClickListener{void onClick(View view);}
 private final Context context;
 public View(Context context){this.context=context;}
 public View(Context context,android.util.AttributeSet attrs){this.context=context;}
 public final Context getContext(){return context;}
 public final ViewParent getParent(){return null;}
 public void setVisibility(int visibility){}
 public int getVisibility(){return GONE;}
 public boolean isShown(){return false;}
 public boolean isAttachedToWindow(){return false;}
 public int getWindowVisibility(){return GONE;}
 public float getAlpha(){return 1f;}
 public final int getWidth(){return 0;}
 public final int getHeight(){return 0;}
 public final boolean getGlobalVisibleRect(Rect r){return false;}
 public void setEnabled(boolean enabled){}
 public void setOnClickListener(OnClickListener l){}
 public void setPadding(int l,int t,int r,int b){}
 public void setBackgroundColor(int color){}
 public void setAccessibilityLiveRegion(int mode){}
 public void announceForAccessibility(CharSequence text){}
 public void setContentDescription(CharSequence text){}
 protected void onAttachedToWindow(){}
 protected void onDetachedFromWindow(){}
 protected void onWindowVisibilityChanged(int visibility){}
 public void onVisibilityAggregated(boolean isVisible){}
}
