// Source contract for Android developer-hook gating and release hardening.
// Source evidence only: it does not build, install or run an APK.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const app = 'android/app/src/main/java/ai/elizaresearch/alphaphone/';

test('developer hooks live only in the test-mocks overlay attached under ELIZA_DEV_ALLOW_TEST_MOCKS', () => {
  assert.equal(fs.existsSync(path.join(root, 'android/app/src/debug')), false, 'src/debug is merged into every debug APK');
  for (const name of ['DevelopmentAgentPlugin', 'DevelopmentVoiceCapture', 'SyntheticAutofillService'])
    assert.ok(fs.existsSync(path.join(root, `android/app/src/testMocks/java/ai/elizaresearch/alphaphone/${name}.java`)), name);
  const gradle = read('android/app/build.gradle');
  assert.match(gradle, /findProperty\('ELIZA_DEV_ALLOW_TEST_MOCKS'\) \?: System\.getenv\('ELIZA_DEV_ALLOW_TEST_MOCKS'\)/);
  assert.match(gradle, /testMocksRaw\.toString\(\) == '1'/, 'flag is on only for exactly "1"');
  assert.match(gradle, /if \(testMocksEnabled\) \{\s*debug\.java\.srcDir file\('src\/testMocks\/java'\)\s*debug\.res\.srcDir file\('src\/testMocks\/res'\)\s*debug\.manifest\.srcFile file\('src\/testMocks\/AndroidManifest\.xml'\)/);
  assert.match(gradle, /buildConfigField 'boolean', 'ELIZA_DEV_ALLOW_TEST_MOCKS', 'false'/);
  assert.match(gradle, /debug \{[^}]*buildConfigField 'boolean', 'ELIZA_DEV_ALLOW_TEST_MOCKS', testMocksEnabled \? 'true' : 'false'/);
  assert.doesNotMatch(gradle, /ALPHA_[A-Z_]+/, 'no invented ALPHA_* switches');
  const overlay = read('android/app/src/testMocks/AndroidManifest.xml');
  for (const marker of ['SyntheticAutofillService', 'peerfixture', 'usesCleartextTraffic="true"']) assert.ok(overlay.includes(marker), marker);
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  for (const marker of ['SyntheticAutofillService', 'peerfixture', 'usesCleartextTraffic="true"', '10.0.2.2']) assert.ok(!manifest.includes(marker), marker);
});

test('main manifest pins an HTTPS-only network policy and drops legacy storage', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android:networkSecurityConfig="@xml\/network_security_config"/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(manifest, /WRITE_EXTERNAL_STORAGE" tools:node="remove"/);
  const policy = read('android/app/src/main/res/xml/network_security_config.xml');
  assert.match(policy, /<base-config cleartextTrafficPermitted="false">/);
  assert.match(policy, /<certificates src="system" \/>/);
  assert.doesNotMatch(policy, /src="user"|domain-config|cleartextTrafficPermitted="true"/);
  // App Links are prepared but inactive: only the existing custom scheme is live.
  const active = manifest.replace(/<!--[\s\S]*?-->/g, '');
  assert.doesNotMatch(active, /autoVerify/);
  assert.match(manifest, /android:autoVerify="true"/);
  assert.match(active, /android:scheme="alphaphone" android:host="cloud-delegation"/);
  const links = JSON.parse(read('android/app/src/main/assetlinks.template.json'));
  assert.equal(links[0].target.package_name, JSON.parse(read('app.config.json')).appId);
  assert.deepEqual(links[0].target.sha256_cert_fingerprints, ['RELEASE_CERT_SHA256_PLACEHOLDER']);
});

test('development behaviour keys on the test-mocks BuildConfig field, not DEBUG', () => {
  for (const name of ['DailyAppsPlugin', 'AlphaMapsTransportPlugin', 'AlphaConnectionPlugin', 'AlphaVoiceCloudPlugin', 'IsolatedPdfService', 'HostedTransport', 'BrowserReading', 'BrowserDownloads']) {
    const source = read(app + name + '.java');
    // DEBUG may gate the closed-field transport diagnostic, never development capabilities.
    const capabilities = name === 'AlphaConnectionPlugin'
      ? source.replace(/private static String debugRequestFailure\([^)]*\) \{[^}]*\}/, '')
      : source;
    assert.doesNotMatch(capabilities, /BuildConfig\.DEBUG/, name);
    assert.match(source, /BuildConfig\.ELIZA_DEV_ALLOW_TEST_MOCKS/, name);
  }
  assert.match(read(app + 'DailyAppsPlugin.java'), /"developmentBuild", BuildConfig\.ELIZA_DEV_ALLOW_TEST_MOCKS/);
  const maps = read(app + 'AlphaMapsTransportPlugin.java');
  assert.match(maps, /DEVELOPMENT_ORIGIN=BuildConfig\.ELIZA_DEV_ALLOW_TEST_MOCKS\?"http:\/\/10\.0\.2\.2:47850":""/);
  assert.equal(maps.split('10.0.2.2:47850').length, 2, 'loopback origin only in the constant-folded field');
  const main = read(app + 'MainActivity.java');
  assert.match(main, /if \(BuildConfig\.ELIZA_DEV_ALLOW_TEST_MOCKS\) \{\s*\/\/[^\n]*\n\s*try \{ registerPlugin\(Class\.forName\("ai\.elizaresearch\.alphaphone\.DevelopmentAgentPlugin"\)/);
  assert.match(main, /WebView\.setWebContentsDebuggingEnabled\(BuildConfig\.DEBUG\)/);
  assert.match(main, /onRenderProcessGone\(WebView view, RenderProcessGoneDetail detail\)/);
  assert.match(main, /getBridge\(\)\.addWebViewListener\(rendererRecovery\)/);
});

test('release signing, versioning and R8 use upstream ELIZAOS_* names without logging secrets', () => {
  const gradle = read('android/app/build.gradle');
  for (const name of ['ELIZAOS_KEYSTORE_PATH', 'ELIZAOS_KEYSTORE_PASSWORD', 'ELIZAOS_KEY_ALIAS', 'ELIZAOS_KEY_PASSWORD', 'ELIZAOS_VERSION_CODE', 'ELIZAOS_VERSION_NAME'])
    assert.ok(gradle.includes(`'${name}'`), name);
  assert.match(gradle, /if \(releaseSigningReady\) signingConfig signingConfigs\.release/);
  for (const line of gradle.split('\n').filter(line => /logger\.|println/.test(line)))
    assert.doesNotMatch(line, /envValue\(|PASSWORD'\)|storePassword|keyPassword/, 'never log signing values');
  assert.match(gradle, /release \{\s*minifyEnabled true\s*shrinkResources true\s*proguardFiles getDefaultProguardFile\('proguard-android-optimize\.txt'\), 'proguard-rules\.pro'/);
  assert.match(gradle, /ndk \{ abiFilters 'arm64-v8a' \}/);
  const config = JSON.parse(read('app.config.json'));
  assert.equal('runtimeMode' in config, false);
  assert.ok(Number.isInteger(config.versionCode) && config.versionCode > 0);
  const rules = read('android/app/proguard-rules.pro');
  for (const keep of ['@com.getcapacitor.annotation.CapacitorPlugin', 'ai.eliza.plugins.**', 'ElizaAgentService', 'AlphaNotificationListener', 'ReminderReceiver', 'IsolatedPdfService', 'AlphaMailFileProvider', 'HostedDeliveryWorker', 'ElizaTasksWorker', 'NativeProcessSupervisor', 'browsersurface', '@android.webkit.JavascriptInterface'])
    assert.ok(rules.includes(keep), keep);
});

test('instrumentation guards mock-only journeys and adds a product no-mock check', () => {
  const dir = 'android/app/src/androidTest/java/ai/elizaresearch/alphaphone/';
  for (const name of ['ConnectionChooserInstrumentedTest', 'BrowserDialogLifecycleInstrumentedTest', 'BrowserContinuityInstrumentedTest', 'CrossAppNotificationsRestartInstrumentedTest', 'CrossAppNotificationsInstrumentedTest'])
    assert.match(read(dir + name + '.java'), /Assume\.assumeTrue\("Mock mode exists only in -PELIZA_DEV_ALLOW_TEST_MOCKS=1 builds",BuildConfig\.ELIZA_DEV_ALLOW_TEST_MOCKS\)/, name);
  assert.match(read(dir + 'AppNavigation.java'), /awaitReady\(!BuildConfig\.ELIZA_DEV_ALLOW_TEST_MOCKS\)/);
  assert.match(read(dir + 'StartupDocumentProbe.java'), /requireLive=requestLive\|\|!BuildConfig\.ELIZA_DEV_ALLOW_TEST_MOCKS/);
  const product = read(dir + 'NoMockProductInstrumentedTest.java');
  for (const marker of ['Enter mock mode', 'Try mock mode', "{kind:'mock'}", '.alpha-connection-scrim']) assert.ok(product.includes(marker), marker);
  // The autofill test compiles against SyntheticAutofillService, so it travels with the overlay.
  assert.equal(fs.existsSync(path.join(root, dir, 'BrowserAutofillInstrumentedTest.java')), false);
  assert.ok(fs.existsSync(path.join(root, 'android/app/src/testMocks/androidTest/java/ai/elizaresearch/alphaphone/BrowserAutofillInstrumentedTest.java')));
  for (const file of fs.readdirSync(path.join(root, dir)))
    assert.doesNotMatch(read(dir + file), /\bSyntheticAutofillService\b|\bDevelopmentVoiceCapture\b|new DevelopmentAgentPlugin/, file);
});

test('renderer recovery backs off after a bounded number of recreations', () => {
  const source = read(app + 'MainActivity.java');
  const start = source.indexOf(' private static final long RECOVERY_WINDOW_MS');
  const end = source.indexOf(' private final WebViewListener rendererRecovery');
  assert.ok(start > 0 && end > start);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-renderer-recovery-'));
  try {
    fs.writeFileSync(path.join(dir, 'RecoveryHarness.java'), `public class RecoveryHarness {
 private boolean recoveringRenderer;
${source.slice(start, end).split('\n').filter(line => !/private boolean recoveringRenderer/.test(line)).join('\n')}
 static void check(boolean x, String m){ if(!x) throw new AssertionError(m); }
 public static void main(String[] a){
  check(rendererRecoveryDelay(1000)==0,"first"); check(rendererRecoveryDelay(2000)==0,"second"); check(rendererRecoveryDelay(3000)==0,"third");
  check(rendererRecoveryDelay(4000)==5000,"fourth in window backs off");
  check(rendererRecoveryDelay(70000)==0,"window resets");
  System.out.println("PASS renderer recovery");
 }
}`);
    const home = process.env.JAVA_HOME || (process.platform === 'darwin' ? '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home' : '');
    const bin = name => home ? path.join(home, 'bin', name) : name;
    execFileSync(bin('javac'), ['--release', '11', '-d', dir, path.join(dir, 'RecoveryHarness.java')], {stdio: 'pipe', timeout: 20000});
    assert.match(execFileSync(bin('java'), ['-cp', dir, 'RecoveryHarness'], {encoding: 'utf8', timeout: 10000}), /^PASS renderer recovery/);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('native content fits real system bars and cutouts without changing launcher or double-counting IME',()=>{
 const source=read(app+'MainActivity.java');
 const start=source.indexOf('-> {',source.indexOf('ViewCompat.setOnApplyWindowInsetsListener('))+4;
 const end=source.indexOf('   return WindowInsetsCompat.CONSUMED;',start);
 assert.ok(start>4&&end>start);
 assert.match(source,/onPageLoaded\(WebView view\)[\s\S]*?requestApplyInsets/);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-insets-'));
 try{
  fs.writeFileSync(path.join(dir,'InsetsHarness.java'),`import java.util.*;
public class InsetsHarness {
 static class Insets { int left,top,right,bottom; Insets(int l,int t,int r,int b){left=l;top=t;right=r;bottom=b;} }
 static class WindowInsetsCompat {
  static class Type {static int ime(){return 1;}static int systemBars(){return 2;}static int displayCutout(){return 4;}}
  Insets bars,cutout,keyboard;boolean visible;
  WindowInsetsCompat(Insets b,Insets c,int k){bars=b;cutout=c;keyboard=new Insets(0,0,0,k);visible=k>0;}
  boolean isVisible(int type){return visible;}
  Insets getInsets(int types){if(types==1)return keyboard;if(types==2)return bars;return new Insets(Math.max(bars.left,cutout.left),Math.max(bars.top,cutout.top),Math.max(bars.right,cutout.right),Math.max(bars.bottom,cutout.bottom));}
 }
 static class BuildConfig {static boolean IS_LAUNCHER;}
 static class View {int l,t,r,b;int getPaddingLeft(){return l;}int getPaddingTop(){return t;}int getPaddingRight(){return r;}int getPaddingBottom(){return b;}void setPadding(int left,int top,int right,int bottom){l=left;t=top;r=right;b=bottom;}}
 static class WebView {List<String> scripts=new ArrayList<>();void evaluateJavascript(String value,Object callback){scripts.add(value);}}
 static class Bridge {WebView web=new WebView();WebView getWebView(){return web;}}
 static class Metrics {float density=3;}
 static class Resources {Metrics metrics=new Metrics();Metrics getDisplayMetrics(){return metrics;}}
 Bridge bridge=new Bridge();Resources resources=new Resources();boolean assistant;int topInsetDp,bottomInsetDp;
 Bridge getBridge(){return bridge;}Resources getResources(){return resources;}boolean isAssistantSurface(){return assistant;}
 void apply(View view,WindowInsetsCompat insets){${source.slice(start,end)}}
 static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
 static Insets zero(){return new Insets(0,0,0,0);}
 public static void main(String[] args){
  InsetsHarness h=new InsetsHarness();View v=new View();Insets portrait=new Insets(0,72,0,144);
  h.apply(v,new WindowInsetsCompat(portrait,zero(),0));
  check(v.t==72&&v.b==144,"standalone bars must protect top navigation and bottom controls");
  check(h.topInsetDp==0&&h.bottomInsetDp==0,"already fitted bars must not be reserved twice in CSS");
  h.apply(v,new WindowInsetsCompat(portrait,new Insets(0,120,0,0),0));check(v.t==120,"cutout may exceed status bar");
  h.apply(v,new WindowInsetsCompat(portrait,zero(),984));check(v.t==72&&v.b==984,"keyboard replaces bottom bar instead of adding to it");
  h.apply(v,new WindowInsetsCompat(new Insets(0,0,0,72),new Insets(136,0,0,0),0));check(v.l==136&&v.t==0&&v.b==72,"rotated cutout and resized window update all sides");
  h.apply(v,new WindowInsetsCompat(portrait,zero(),0));check(v.l==0&&v.t==72&&v.b==144,"portrait clears old landscape padding");
  BuildConfig.IS_LAUNCHER=true;h.apply(v,new WindowInsetsCompat(portrait,zero(),0));
  check(v.l==0&&v.t==0&&v.r==0&&v.b==0&&h.topInsetDp==24&&h.bottomInsetDp==48,"launcher retains reference canvas and remaining CSS inset contract");
  h.apply(v,new WindowInsetsCompat(portrait,zero(),984));check(v.b==984&&h.bottomInsetDp==0,"launcher keeps original keyboard resize");
  h.assistant=true;h.apply(v,new WindowInsetsCompat(portrait,zero(),0));check(v.t==72&&v.b==144&&h.topInsetDp==0&&h.bottomInsetDp==0,"assistant activity also fits real bars");
  h.bridge.web.scripts.clear();h.apply(v,new WindowInsetsCompat(portrait,zero(),0));check(h.bridge.web.scripts.size()==2,"new document receives both CSS insets even if values did not change");
  System.out.println("PASS native insets");
 }
}`);
  const home=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');
  const bin=name=>home?path.join(home,'bin',name):name;
  execFileSync(bin('javac'),['--release','11','-d',dir,path.join(dir,'InsetsHarness.java')],{stdio:'pipe',timeout:20000});
  assert.match(execFileSync(bin('java'),['-cp',dir,'InsetsHarness'],{encoding:'utf8',timeout:10000}),/^PASS native insets/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
