#!/usr/bin/env python3
"""Actual gateway HTTP admission/revision flow with disposable synthetic data."""
import contextlib, importlib.util, json, os, pathlib, sqlite3, tempfile, threading, urllib.error, urllib.request
from dataset_manifest import seal, verify, identity

HERE = pathlib.Path(__file__).resolve().parent
@contextlib.contextmanager
def gateway(root, before_answer=None):
    os.environ['ALPHA_MAPS_DATA'] = str(root)
    spec = importlib.util.spec_from_file_location('fixture_gateway', HERE / 'serve-region.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if before_answer:
        original = module.Handler.answer
        def answer(self, *args, **kwargs):
            before_answer()
            return original(self, *args, **kwargs)
        module.Handler.answer = answer
    server = module.http.server.ThreadingHTTPServer(('127.0.0.1', 0), module.Handler)
    worker = threading.Thread(target=lambda: server.serve_forever(poll_interval=0.05))
    worker.start()
    try:
        yield 'http://127.0.0.1:' + str(server.server_port)
    finally:
        server.shutdown()
        server.server_close()
        worker.join()

def get(base, path):
    with urllib.request.urlopen(base + path, timeout=3) as response:
        return json.load(response)

with tempfile.TemporaryDirectory(prefix='alpha-maps-manifest-') as directory:
    root = pathlib.Path(directory)
    (root / 'graph-cache').mkdir()
    for name in ['source-manifest.json', 'monaco.osm.pbf', 'monaco.mbtiles', 'graphhopper.jar', 'graph-cache/properties', 'graph-cache/edges']:
        (root / name).write_bytes(b'Synthetic admission fixture')
    with sqlite3.connect(root / 'places.sqlite') as db:
        db.execute('PRAGMA journal_mode=WAL')
        db.execute('CREATE TABLE places(id TEXT PRIMARY KEY,name TEXT,lat REAL,lon REAL,tags TEXT)')
        db.execute('INSERT INTO places VALUES(?,?,?,?,?)', ('fixture', 'Original fixture', 43.7384, 7.4246, '{}'))
    db.close()
    seal(root)
    first = verify(root)[0]
    seal(root)
    assert verify(root)[0] == first, 'Sealing unchanged data must be deterministic'
    with gateway(root) as base:
        assert get(base, '/capabilities')['revision'] == first
        assert get(base, '/search?q=Original')[0]['name'] == 'Original fixture'
        assert not list(root.glob('places.sqlite-*')), 'Immutable reads must not create WAL sidecars'
        with sqlite3.connect(root / 'places.sqlite') as db:
            db.execute('UPDATE places SET name=?', ('Changed fixture',))
        try:
            get(base, '/search?q=Changed')
            raise AssertionError('Changed data was served under the old revision')
        except urllib.error.HTTPError as error:
            assert error.code == 503
        db.close()
    try:
        with gateway(root):
            raise AssertionError('Gateway admitted a stale manifest')
    except ValueError:
        pass
    seal(root)
    second = verify(root)[0]
    assert second != first
    with gateway(root) as base:
        assert get(base, '/capabilities')['revision'] == second
        assert get(base, '/search?q=Changed')[0]['name'] == 'Changed fixture'
    def change_after_read():
        with (root / 'graph-cache/edges').open('ab') as output:
            output.write(b'changed after read')
    with gateway(root, change_after_read) as base:
        try:
            get(base, '/search?q=Changed')
            raise AssertionError('Response emitted after concurrent dataset change')
        except urllib.error.HTTPError as error:
            assert error.code == 503
    seal(root)
    with gateway(root) as base:
        main_identity = identity(root / 'places.sqlite')
        with sqlite3.connect(root / 'places.sqlite') as writer:
            writer.execute('PRAGMA journal_mode=WAL')
            writer.execute('UPDATE places SET name=?', ('WAL fixture',))
            writer.commit()
            assert identity(root / 'places.sqlite') == main_identity, 'WAL change must isolate unchanged main-file case'
            try:
                get(base, '/search?q=WAL')
                raise AssertionError('WAL changes were served')
            except urllib.error.HTTPError as error:
                assert error.code == 503
            try:
                seal(root)
                raise AssertionError('Live WAL dataset was sealed')
            except ValueError:
                pass
        writer.close()
    seal(root)
    for name in ['graph-cache/edges', 'monaco.mbtiles', 'graphhopper.jar']:
        previous = verify(root)[0]
        with (root / name).open('ab') as output:
            output.write(b'changed')
        try:
            verify(root)
            raise AssertionError('Changed runtime input admitted: ' + name)
        except ValueError:
            pass
        seal(root)
        assert verify(root)[0] != previous
    (root / 'graph-cache/edges').unlink()
    try:
        verify(root)
        raise AssertionError('Missing graph input admitted')
    except ValueError:
        pass
print('PASS: actual gateway revision/search, live drift refusal, stale startup refusal, explicit reseal and graph/tile/router identity; synthetic dataset only')
