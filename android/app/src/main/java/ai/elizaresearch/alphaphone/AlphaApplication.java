package ai.elizaresearch.alphaphone;

/** Install the read-only native source callback before any resident service starts. */
public final class AlphaApplication extends android.app.Application {
 @Override public void onCreate(){super.onCreate();NativeDigestHost host=new NativeDigestHost(this);NativeSourceHost.configure(host::read);}
}
