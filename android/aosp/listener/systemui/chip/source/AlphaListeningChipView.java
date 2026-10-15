package com.android.systemui.privacy;

import android.content.Context;
import android.util.AttributeSet;
import android.view.Gravity;
import android.widget.TextView;
import com.android.systemui.res.R;

/** Independent fixed-text surface. Parent visibility/health remains an image qualification gate. */
public final class AlphaListeningChipView extends TextView {
 public AlphaListeningChipView(Context context){this(context,null);}
 public AlphaListeningChipView(Context context,AttributeSet attrs){
  super(context,attrs);setGravity(Gravity.CENTER);setTextSize(12);setTextColor(0xffffffff);
  setBackgroundColor(0xff174e35);setPadding(8,2,8,2);setAccessibilityLiveRegion(ACCESSIBILITY_LIVE_REGION_POLITE);
  setOnClickListener(view->{if(!AlphaListeningController.pause())announceForAccessibility(getContext().getString(R.string.alpha_listening_pause_unavailable));});
  render(false);
 }
 @Override protected void onAttachedToWindow(){super.onAttachedToWindow();AlphaListeningController.attach(this);}
 @Override protected void onDetachedFromWindow(){AlphaListeningController.detach(this);super.onDetachedFromWindow();}
 void render(boolean active){setText(R.string.alpha_listening_pause);setContentDescription(getContext().getString(R.string.alpha_listening_pause));setVisibility(active?VISIBLE:GONE);setEnabled(active);}
}
