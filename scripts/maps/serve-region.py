#!/usr/bin/env python3
"""Loopback-only regional maps gateway; bounded requests, no public API fallback."""
from dataset_manifest import verify, snapshot
import http.server,urllib.parse,urllib.request,sqlite3,json,pathlib,os,time,math,hashlib,re
ROOT=pathlib.Path(os.environ.get('ALPHA_MAPS_DATA',str(pathlib.Path.home()/'.local/share/alphaphone-maps/monaco'))).resolve()
ATTR='© OpenStreetMap contributors (ODbL); OpenMapTiles (CC-BY 4.0)'
BOUNDS=[7.409,43.724,7.449,43.752]
PROVIDER='alpha-osm-monaco'
REV,DATASET=verify(ROOT)
# GraphHopper instruction sign -> provider-neutral maneuver (plugin-maps MANEUVERS).
SIGNS={-98:'u-turn',-8:'u-turn',8:'u-turn',-7:'keep-left',7:'keep-right',-3:'sharp-left',-2:'left',-1:'slight-left',0:'continue',1:'slight-right',2:'right',3:'sharp-right',4:'arrive',5:'continue',6:'roundabout',-6:'continue'}
def maneuver(index,step):
 sign=step.get('sign')
 if index==0 and sign==0:return 'depart'
 return SIGNS.get(sign)
def details(tags):
 # Only well-formed source values; malformed tags are omitted, never guessed.
 value={}
 phone=(tags.get('phone') or '').split(';')[0].strip()
 if phone and re.fullmatch(r'[+0-9() .-]{3,80}',phone):value['phone']=phone
 website=(tags.get('website') or '').split(';')[0].strip()
 if website and len(website)<=2048:
  parts=urllib.parse.urlsplit(website)
  if parts.scheme in ('http','https') and parts.netloc and '@' not in parts.netloc:value['website']=website
 hours=(tags.get('opening_hours') or '').strip()
 if hours and len(hours)<=255 and not re.search(r'[\x00-\x1f]',hours):value['openingHours']=hours
 return value
def inside(p):return len(p)==2 and all(math.isfinite(v) for v in p) and BOUNDS[0]<=p[1]<=BOUNDS[2] and BOUNDS[1]<=p[0]<=BOUNDS[3]
def place(row,detail=False):
 ident,name,lat,lon,tags=row;tags=json.loads(tags)
 value={'providerId':PROVIDER,'id':ident,'name':name,'coordinate':{'latitude':lat,'longitude':lon},'attribution':ATTR,'fetchedAt':int(time.time()*1000)}
 address=' '.join(filter(None,[tags.get('addr:housenumber'),tags.get('addr:street'),tags.get('addr:city')]))
 if address:value['address']=address
 if detail:value.update(details(tags))
 return value
class Handler(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args):pass # Queries/coordinates are not access-log data.
 def answer(self,value,status=200,mime='application/json',gzip=False):
  # Recheck after database/router reads, before publishing any captured response.
  try:
   if snapshot(ROOT)!=DATASET:raise ValueError()
  except (OSError,ValueError):value,status,mime,gzip={'error':'Regional dataset changed; restart after review.'},503,'application/json',False
  data=value if isinstance(value,bytes) else json.dumps(value).encode()
  self.send_response(status);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(data)))
  origin=self.headers.get('Origin','')
  if origin in ['https://localhost','http://localhost','capacitor://localhost'] or origin.startswith('http://127.0.0.1:'):
   self.send_header('Access-Control-Allow-Origin',origin);self.send_header('Vary','Origin')
  self.send_header('Cache-Control','public,max-age=3600' if mime.endswith('protobuf') else 'no-store')
  if gzip:self.send_header('Content-Encoding','gzip')
  self.end_headers();self.wfile.write(data)
 def do_GET(self):
  try:
   if snapshot(ROOT)!=DATASET:raise ValueError()
  except (OSError,ValueError):return self.answer({'error':'Regional dataset changed; restart after review.'},503)
  if len(self.path)>5000:return self.answer({'error':'Request too large'},414)
  if self.headers.get('Host','').split(':')[0] not in ['127.0.0.1','localhost','10.0.2.2']:return self.answer({'error':'Host rejected'},403)
  parsed=urllib.parse.urlsplit(self.path);query=urllib.parse.parse_qs(parsed.query)
  try:
   if parsed.path=='/capabilities':return self.answer({'providerId':PROVIDER,'connectionId':'conn_alpha_regional_monaco_001','revision':REV,'region':'Monaco · regional OSM data','bounds':BOUNDS,'attribution':ATTR,'capabilities':{'map':True,'search':True,'placeDetails':True,'modes':['drive','walk','bicycle'],'traffic':'none','transit':'none','offline':{'map':False,'search':False,'routing':False}}})
   if parsed.path in ['/search','/place']:
    with sqlite3.connect((ROOT/'places.sqlite').as_uri()+'?mode=ro&immutable=1',uri=True) as db:
     if parsed.path=='/place':
      rows=db.execute('SELECT * FROM places WHERE id=?',(query.get('id',[''])[0][:512],)).fetchall();return self.answer(place(rows[0],True) if rows else None)
     text=query.get('q',[''])[0].strip()
     if not text or len(text)>300:return self.answer([])
     # Parameters and escaped LIKE wildcards; named places, not global geocoding.
     key='%'+text.replace('\\','\\\\').replace('%','\\%').replace('_','\\_')+'%'
     rows=db.execute("SELECT * FROM places WHERE name LIKE ? ESCAPE '\\' ORDER BY name LIMIT 30",(key,)).fetchall()
     return self.answer([place(r) for r in rows])
   if parsed.path.startswith('/tiles/'):
    parts=parsed.path.split('/');z,x,y=int(parts[2]),int(parts[3]),int(parts[4].replace('.pbf',''))
    if len(parts)!=5 or not 0<=z<=14 or not 0<=x<2**z or not 0<=y<2**z:raise ValueError()
    with sqlite3.connect((ROOT/'monaco.mbtiles').as_uri()+'?mode=ro&immutable=1',uri=True) as db:row=db.execute('SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?',(z,x,2**z-1-y)).fetchone()
    if not row:return self.answer(b'',204,'application/x-protobuf')
    return self.answer(row[0],mime='application/x-protobuf',gzip=row[0][:2]==b'\x1f\x8b')
   if parsed.path=='/route':
    start=[float(v) for v in query.get('from',[''])[0].split(',')];end=[float(v) for v in query.get('to',[''])[0].split(',')];mode=query.get('mode',[''])[0]
    if not inside(start) or not inside(end):return self.answer({'error':'Both endpoints must be inside the Monaco region.'},422)
    profiles={'drive':'car','walk':'foot','bicycle':'bike'}
    if mode not in profiles:return self.answer({'error':'This route mode is unavailable.'},422)
    params=urllib.parse.urlencode([('point',','.join(map(str,start))),('point',','.join(map(str,end))),('profile',profiles[mode]),('points_encoded','false'),('instructions','true'),('locale','en')])
    with urllib.request.urlopen('http://127.0.0.1:47851/route?'+params,timeout=12) as response:
     raw=response.read(2*1024*1024+1)
     if len(raw)>2*1024*1024:raise ValueError()
    result=json.loads(raw);route=result['paths'][0];coords=route['points']['coordinates']
    def point(p):return {'latitude':p[1],'longitude':p[0]}
    steps=[]
    for index,s in enumerate(route['instructions']):
     step={'instruction':s['text'],'coordinate':point(coords[s['interval'][0]]),'distanceMeters':s['distance']}
     kind=maneuver(index,s)
     if kind:step['maneuver']=kind
     steps.append(step)
    return self.answer({'providerId':PROVIDER,'id':'route_'+hashlib.sha256(params.encode()).hexdigest()[:20],'from':{'latitude':start[0],'longitude':start[1]},'to':{'latitude':end[0],'longitude':end[1]},'mode':mode,'geometry':[point(p) for p in coords],'distanceMeters':route['distance'],'durationSeconds':route['time']/1000,'steps':steps,'attribution':ATTR,'fetchedAt':int(time.time()*1000),'traffic':'none'})
   self.answer({'error':'Not found'},404)
  except urllib.error.HTTPError:self.answer({'error':'No route available for these endpoints.'},422)
  except (TimeoutError,ConnectionError,urllib.error.URLError):self.answer({'error':'Regional routing service unavailable.'},503)
  except Exception:self.answer({'error':'Invalid regional request or unavailable data.'},400)
if __name__ == '__main__':
 http.server.ThreadingHTTPServer(('127.0.0.1',47850),Handler).serve_forever()
