#!/usr/bin/env python3
"""Explicitly seal, or verify, the complete prepared regional runtime dataset."""
import argparse, hashlib, json, os, pathlib, stat

HERE = pathlib.Path(__file__).resolve().parent
NAME = 'runtime-manifest.json'
REQUIRED = ('source-manifest.json', 'monaco.osm.pbf', 'monaco.mbtiles', 'places.sqlite', 'graphhopper.jar', 'graph-cache/properties')

def inventory(root):
    root = pathlib.Path(root).resolve()
    for database in ('places.sqlite', 'monaco.mbtiles'):
        for suffix in ('-wal', '-shm', '-journal'):
            if (root / (database + suffix)).exists() or (root / (database + suffix)).is_symlink():
                raise ValueError('Checkpoint and close SQLite writers before sealing or serving')
    paths = set(REQUIRED)
    graph = root / 'graph-cache'
    if graph.is_symlink() or not graph.is_dir():
        raise ValueError('A real prepared graph-cache directory is required')
    for path in graph.rglob('*'):
        if path.is_symlink():
            raise ValueError('Dataset symlinks are not supported')
        if path.is_file():
            paths.add(path.relative_to(root).as_posix())
    if len(paths) > 256:
        raise ValueError('Unexpected regional dataset inventory')
    return {**{name: root / name for name in sorted(paths)}, '@config/graphhopper.yml': HERE / 'graphhopper.yml'}

def identity(path):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode):
        raise ValueError('Dataset entries must be regular files')
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns)

def snapshot(root):
    return {name: identity(path) for name, path in inventory(root).items()}

def describe(root):
    entries = {}
    for name, path in inventory(root).items():
        before = identity(path)
        digest = hashlib.sha256()
        with path.open('rb') as source:
            for block in iter(lambda: source.read(1024 * 1024), b''):
                digest.update(block)
        if before != identity(path):
            raise ValueError('Dataset changed while being hashed')
        entries[name] = {'bytes': before[2], 'sha256': digest.hexdigest()}
    return {'schema': 1, 'providerId': 'alpha-osm-monaco', 'bounds': [7.409, 43.724, 7.449, 43.752], 'files': entries}

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()

def seal(root):
    root = pathlib.Path(root).resolve()
    value = describe(root)
    # Publication is explicit, atomic, and separate from gateway startup.
    temporary = root / (NAME + '.tmp-' + str(os.getpid()))
    try:
        with temporary.open('xb') as output:
            output.write(canonical(value) + b'\n')
            output.flush()
            os.fsync(output.fileno())
        temporary.replace(root / NAME)
    finally:
        temporary.unlink(missing_ok=True)
    return value

def verify(root):
    root = pathlib.Path(root).resolve()
    before = snapshot(root)
    path = root / NAME
    if path.is_symlink() or path.stat().st_size > 128 * 1024:
        raise ValueError('Invalid runtime manifest')
    expected = json.loads(path.read_text())
    actual = describe(root)
    if expected != actual or before != snapshot(root):
        raise ValueError('Regional dataset changed; review and explicitly reseal it before serving')
    return hashlib.sha256(canonical(actual)).hexdigest()[:24], before

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['seal', 'verify'])
    parser.add_argument('--data', type=pathlib.Path, default=pathlib.Path(os.environ.get('ALPHA_MAPS_DATA', str(pathlib.Path.home() / '.local/share/alphaphone-maps/monaco'))))
    args = parser.parse_args()
    if args.operation == 'seal':
        seal(args.data)
    revision, _ = verify(args.data)
    print(json.dumps({'providerId': 'alpha-osm-monaco', 'revision': revision, 'verified': True}))
