package com.android.systemui.privacy

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.repeatOnLifecycle
import com.android.app.tracing.coroutines.launchTraced as launch
import com.android.systemui.keyguard.ui.viewmodel.KeyguardIndicationAreaViewModel
import com.android.systemui.lifecycle.repeatWhenAttached
import com.android.systemui.res.R
import kotlinx.coroutines.DisposableHandle

/** Sibling of rotating indications: same existing burn-in motion, independent content/visibility. */
object AlphaListeningChipBinder {
    fun bind(view: AlphaListeningChipView, model: KeyguardIndicationAreaViewModel): DisposableHandle =
        view.repeatWhenAttached {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch("AlphaListening#burnInX") {
                    model.indicationAreaTranslationX.collect { view.translationX = it }
                }
                launch("AlphaListening#burnInY") {
                    val offset = view.resources.getDimensionPixelOffset(R.dimen.default_burn_in_prevention_offset)
                    model.indicationAreaTranslationY(offset).collect { view.translationY = it }
                }
            }
        }
}
