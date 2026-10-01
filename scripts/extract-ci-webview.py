"""Validate the pinned four-member Chromium archive before extracting one APK."""
import pathlib, stat, sys, zipfile
archive, output = map(pathlib.Path, sys.argv[1:])
expected = {'chrome-android-desktop/apks/' + name + '.apk' for name in
            ['ChromePublic', 'ContentShell', 'SystemWebView', 'SystemWebViewShell']}
with zipfile.ZipFile(archive) as source:
    entries = source.infolist()
    assert len(entries) == 4 and {entry.filename for entry in entries} == expected
    for entry in entries:
        name = pathlib.PurePosixPath(entry.filename)
        assert not name.is_absolute() and '..' not in name.parts and '\\' not in entry.filename
        assert stat.S_IFMT(entry.external_attr >> 16) in (0, stat.S_IFREG)
    assert not output.exists()
    with output.open('xb') as target:
        target.write(source.read('chrome-android-desktop/apks/SystemWebView.apk'))
