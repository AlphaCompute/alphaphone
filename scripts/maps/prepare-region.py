#!/usr/bin/env python3
"""Build a bounded real OSM Monaco region; never calls public search/route APIs."""
import pathlib,urllib.request,hashlib,json,subprocess,os,sys
root=pathlib.Path(os.environ.get('ALPHA_MAPS_DATA',str(pathlib.Path.home()/'.local/share/alphaphone-maps/monaco'))).resolve()
root.mkdir(parents=True,exist_ok=True,mode=0o700)
assets={
 'monaco.osm.pbf':'https://download.geofabrik.de/europe/monaco-260929.osm.pbf',
 'planetiler.jar':'https://github.com/onthegomap/planetiler/releases/download/v0.10.2/planetiler.jar',
 'graphhopper.jar':'https://repo.maven.apache.org/maven2/com/graphhopper/graphhopper-web/10.2/graphhopper-web-10.2.jar',
 'water.zip':'https://raw.githubusercontent.com/onthegomap/planetiler/v0.10.2/planetiler-core/src/test/resources/water-polygons-split-3857.zip',
 'earth.zip':'https://raw.githubusercontent.com/onthegomap/planetiler/v0.10.2/planetiler-core/src/test/resources/natural_earth_vector.sqlite.zip',
}
manifest={}
for name,url in assets.items():
 p=root/name
 if not p.exists():
  request=urllib.request.Request(url,headers={'User-Agent':'AlphaPhone-RegionalMaps/0.1 (+https://github.com/eliza-research/alphaphone)'})
  with urllib.request.urlopen(request,timeout=60) as response, open(str(p)+'.partial','wb') as out:
   size=0
   while chunk:=response.read(1024*1024):
    size+=len(chunk)
    if size>160*1024*1024:raise RuntimeError('Bounded download limit')
    out.write(chunk)
  pathlib.Path(str(p)+'.partial').replace(p)
 manifest[name]={'url':url,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size}
 print(name,manifest[name]['bytes'],flush=True)
(root/'source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
if not (root/'monaco.mbtiles').exists():
 subprocess.run(['java','-Xmx1g','-jar',str(root/'planetiler.jar'),'--osm-path='+str(root/'monaco.osm.pbf'),'--water-polygons-path='+str(root/'water.zip'),'--natural-earth-path='+str(root/'earth.zip'),'--output='+str(root/'monaco.mbtiles'),'--bounds=7.409,43.724,7.449,43.752','--threads=2','--download'],cwd=root,check=True,timeout=600)
for name in ['monaco.mbtiles','places.sqlite','data/sources/lake_centerline.shp.zip']:
 p=root/name
 if p.exists():manifest[name]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size}
if 'data/sources/lake_centerline.shp.zip' in manifest:manifest['data/sources/lake_centerline.shp.zip']['url']='https://github.com/acalcutt/osm-lakelines/releases/download/v12/lake_centerline.shp.zip'
(root/'source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Prepared',root)
