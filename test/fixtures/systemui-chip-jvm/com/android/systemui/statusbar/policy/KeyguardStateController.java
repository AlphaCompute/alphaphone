package com.android.systemui.statusbar.policy;
public interface KeyguardStateController {
 boolean isShowing();
 void addCallback(Callback callback);
 interface Callback { default void onKeyguardShowingChanged(){} }
}
