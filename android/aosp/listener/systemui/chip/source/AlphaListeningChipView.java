package com.android.systemui.privacy;

import android.content.Context;
import android.graphics.Rect;
import android.util.AttributeSet;
import android.view.Gravity;
import android.view.View;
import android.view.ViewParent;
import android.widget.TextView;
import com.android.systemui.res.R;

/** Independent fixed-text surface. Its measured visibility feeds the listener's health lease. */
public final class AlphaListeningChipView extends TextView {
 private boolean aggregated; // main thread only
 /** Created in code by the keyguard indication-area section (lock screen and AOD); inflated in status_bar.xml otherwise. */
 private final boolean keyguard;
 public AlphaListeningChipView(Context context){this(context,null,true);}
 public AlphaListeningChipView(Context context,AttributeSet attrs){this(context,attrs,false);}
 private AlphaListeningChipView(Context context,AttributeSet attrs,boolean keyguard){
  super(context,attrs);this.keyguard=keyguard;setGravity(Gravity.CENTER);setTextSize(12);setTextColor(0xffffffff);
  setBackgroundColor(0xff174e35);setPadding(8,2,8,2);setAccessibilityLiveRegion(ACCESSIBILITY_LIVE_REGION_POLITE);
  setOnClickListener(view->{if(!AlphaListeningController.pause())announceForAccessibility(getContext().getString(R.string.alpha_listening_pause_unavailable));});
  render(false);
 }
 @Override protected void onAttachedToWindow(){super.onAttachedToWindow();AlphaListeningController.attach(this);}
 @Override protected void onDetachedFromWindow(){AlphaListeningController.detach(this);super.onDetachedFromWindow();}
 @Override public void onVisibilityAggregated(boolean visible){super.onVisibilityAggregated(visible);aggregated=visible;AlphaListeningController.surfaceChanged();}
 @Override protected void onWindowVisibilityChanged(int visibility){super.onWindowVisibilityChanged(visibility);AlphaListeningController.surfaceChanged();}
 void render(boolean active){setText(R.string.alpha_listening_pause);setContentDescription(getContext().getString(R.string.alpha_listening_pause));setVisibility(active?VISIBLE:GONE);setEnabled(active);AlphaListeningController.surfaceChanged();}

 /** Lock-screen/AOD surface rather than the status bar. */
 boolean keyguardSurface(){return keyguard;}

 /** The rendered chip itself is effectively on screen. */
 boolean chipVisible(){return getVisibility()==VISIBLE&&measured(this,aggregated);}

 /** The surface that shows the chip (status bar or keyguard indication area) is effectively on screen. */
 boolean hostVisible(){ViewParent parent=getParent();return parent instanceof View&&measured((View)parent,((View)parent).isShown());}

 private static boolean measured(View view,boolean aggregated){
  Rect rect=new Rect();
  boolean onScreen=view.getGlobalVisibleRect(rect);
  float alpha=view.getAlpha();
  for(ViewParent node=view.getParent();node instanceof View;node=node.getParent())alpha*=((View)node).getAlpha();
  return AlphaListeningPolicy.effectivelyVisible(view.isAttachedToWindow(),view.getWindowVisibility()==VISIBLE,view.isShown(),aggregated,
   alpha,onScreen?(long)rect.width()*rect.height():0,(long)view.getWidth()*view.getHeight());
 }
}
