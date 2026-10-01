#!/usr/bin/env python3
"""Derive a named-place index from the same licensed real OSM extract as tiles/routes."""
import osmium,sqlite3,pathlib,os,json
root=pathlib.Path(os.environ.get('ALPHA_MAPS_DATA',str(pathlib.Path.home()/'.local/share/alphaphone-maps/monaco')))
db=sqlite3.connect(root/'places.sqlite');db.execute('CREATE TABLE IF NOT EXISTS places(id TEXT PRIMARY KEY,name TEXT,lat REAL,lon REAL,tags TEXT)');db.execute('DELETE FROM places')
class Index(osmium.SimpleHandler):
 def save(self,kind,item,lat,lon):
  tags=dict(item.tags);name=tags.get('name') or ' '.join(filter(None,[tags.get('addr:housenumber'),tags.get('addr:street')]))
  if not name or not(-180<=lon<=180 and -90<=lat<=90):return
  if not(7.409<=lon<=7.449 and 43.724<=lat<=43.752):return
  kept={k:v for k,v in tags.items() if k in ['amenity','shop','tourism','leisure','addr:street','addr:housenumber','addr:city','website','phone','opening_hours']}
  db.execute('INSERT OR REPLACE INTO places VALUES(?,?,?,?,?)',(kind+str(item.id),name[:300],lat,lon,json.dumps(kept)))
 def node(self,n):
  if n.location.valid():self.save('n',n,n.location.lat,n.location.lon)
 def way(self,w):
  # Representative location for named ways/areas, not a fabricated street address.
  if not(w.tags.get('name') or w.tags.get('addr:street')):return
  points=[(n.lat,n.lon) for n in w.nodes if n.location.valid()]
  if points:self.save('w',w,sum(p[0] for p in points)/len(points),sum(p[1] for p in points)/len(points))
Index().apply_file(str(root/'monaco.osm.pbf'),locations=True)
db.commit();print('Named regional places:',db.execute('SELECT count(*) FROM places').fetchone()[0]);db.close()
