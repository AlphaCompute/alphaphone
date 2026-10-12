package ai.elizaresearch.alphaphone;

import android.Manifest;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

/** Product policy stays in Alpha; shared System behavior is unchanged for other hosts. */
@CapacitorPlugin(name="ElizaSystem",permissions={@Permission(alias="camera",strings={Manifest.permission.CAMERA})})
public final class AlphaSystemPlugin extends ai.eliza.plugins.system.SystemPlugin {
 @Override protected boolean isRoleEnabled(String role){return AlphaImageCapabilities.roleEnabled(role);}
 @Override protected boolean isDefaultAppEnabled(String role){return AlphaImageCapabilities.defaultAppEnabled(getContext(),role);}
}
