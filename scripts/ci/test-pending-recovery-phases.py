"""Execute the actual owned phase loop with synthetic command responses; no adb."""
import ast,json,signal,sys,tempfile,uuid,re,subprocess
from pathlib import Path
from recovery_ui_guard import terminal
source=Path(__file__).parent/'pending-recovery-ui.py'
tree=ast.parse(source.read_text());phases=next(n for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='PHASES' for t in n.targets));outer=next(n for n in tree.body if isinstance(n,ast.For) and isinstance(n.target,ast.Name) and n.target.id=='variant');loop=next(n for n in ast.walk(outer) if isinstance(n,ast.For) and isinstance(n.target,ast.Tuple) and n.target.elts[0].id=='phase');code=compile(ast.fix_missing_locations(ast.Module(body=[phases,loop],type_ignores=[])),str(source),'exec')
APP='ai.elizaresearch.alphaphone';TEST=APP+'.test';expected=APP+'.ReminderAgentInstrumentedTest#selectedCrudPersistsExactReceiptsAndRejectsChangedBindings'
for variant in ['standalone','launcher']:
 for fault in ['none','skip','wrong-method','permission-denied','none-skip','none-wrong','numeric-skip','numeric-wrong','transport-skip','transport-wrong','cloud-cold-skip','cloud-cold-wrong','cloud-warm-skip','cloud-warm-wrong','tap-skip','tap-wrong','tap-permission-denied','cleanup-unsettled']:
  state={'user':None,'current':'0','name':None,'notifications':False};calls=[];methods=[]
  def run(*args,**kwargs):
   calls.append(args)
   if args==('shell','pm','list','users'):return 'UserInfo{0:Owner:13}'
   if args[:3]==('shell','pm','create-user'):assert state['user'] is None;state.update(user='10',name=args[3],notifications=False);return 'Success: created user id 10'
   if args[:3]==('shell','am','get-started-user-state'):return 'RUNNING_UNLOCKED'
   if args[:3]==('shell','pm','grant'):
    assert args[3:6]==('--user','10',APP)
    if args[-1]=='android.permission.POST_NOTIFICATIONS':
     if fault=='permission-denied' or fault=='tap-permission-denied' and state['name'] and len(methods)==9:raise RuntimeError('Grant denied')
     state['notifications']=True
   if args[:3]==('shell','am','instrument'):
    assert state['current']=='10' and kwargs['timeout']==300
    selector=args[args.index('class')+1];methods.append(selector)
    cls,method=selector.split('#')
    timingCase='none' if 'noAlertBridgeWithoutPermission' in method else 'numeric' if 'numericLeadDueTime' in method else None
    if timingCase:
     assert state['notifications']==(timingCase=='numeric')
     assert args[args.index('class')+2:args.index('class')+5]==('-e','reminderTiming',timingCase)
     if fault==timingCase+'-wrong':method='other'
    if selector==expected:
     assert ('shell','pm','grant','--user','10',APP,'android.permission.POST_NOTIFICATIONS') in calls
     assert args[args.index('class')+2:args.index('class')+5]==('-e','reminderAgent','1')
     if fault=='wrong-method':method='other'
    transport='encryptedCredentialsAndHttp' in method
    if transport:
     assert not state['notifications']
     assert args[args.index('class')+2:args.index('class')+5]==('-e','reminderTransport','v2')
     if fault=='transport-wrong':method='other'
    cloud='cold' if method=='coldCallbackSurvivesRecreationAndOnlyMatchingClear' else 'warm' if method=='warmCallbackRejectsMalformedLinksAndRetainsLatestOnRecreation' else None
    if cloud:
     assert cls==APP+'.CloudDelegationCallbackInstrumentedTest' and not state['notifications']
     assert args[args.index('class')+2:args.index('class')+5]==('-e','cloudDelegationNative','1')
     if fault=='cloud-'+cloud+'-wrong':method='other'
    tap=method=='twoOpaqueNoticesRetainColdWarmAndFailedCaptureRoutes'
    if tap:
     assert cls==APP+'.WorkflowNoticeTapInstrumentedTest' and state['notifications']
     assert args[args.index('class')+2:args.index('class')+5]==('-e','workflowNoticeTap','1')
     if fault=='tap-wrong':method='other'
    start=f'INSTRUMENTATION_STATUS: class={cls}\nINSTRUMENTATION_STATUS: test={method}\nINSTRUMENTATION_STATUS: numtests=1\nINSTRUMENTATION_STATUS_CODE: '
    return start+'1\n'+start+('-3' if selector==expected and fault=='skip' or timingCase and fault==timingCase+'-skip' or transport and fault=='transport-skip' or cloud and fault=='cloud-'+cloud+'-skip' or tap and fault=='tap-skip' else '0')+'\nINSTRUMENTATION_RESULT: stream=\nOK (1 test)\nINSTRUMENTATION_CODE: -1\n'
   if args[:3]==('shell','pm','remove-user'):assert state['current']=='0';state.update(user=None,name=None)
   return ''
  def owned(run,user,name,current=None):assert user==state['user'] and name==state['name'];assert current is None or state['current']==current
  def switch(target,user,name):
   owned(run,user,name);state['current']=target
   if fault=='cleanup-unsettled' and target=='0':raise AssertionError('Owned foreground switch timed out')
  def guard():assert state['current']=='0'
  def installed(pkg,user,digest):assert user=='10' and digest==variant
  def admit_display(run,user,name,record):owned(run,user,name,user);record({'admitted':True})
  with tempfile.TemporaryDirectory() as directory:
   env=dict(globals(),out=Path(directory),manifest={variant+'-'+k+'.apk':variant for k in ['debug','androidTest']},assert_no_resident=lambda run:None,interrupted=lambda *args:None)
   failed=False
   try:exec(code,env)
   except (AssertionError,RuntimeError):failed=True
   assert failed==(fault!='none'),(variant,fault,failed)
   if fault=='cleanup-unsettled':
    assert state['user']=='10' and state['current']=='0'
    assert not any('stop-user' in c or 'remove-user' in c for c in calls)
    rows=[json.loads(p.read_text()) for p in Path(directory).glob('*ownership.json')]
    assert len(rows)==1 and rows[0]['cleanupComplete'] is False and rows[0]['state']=='owned'
    print('PASS',variant,fault)
    continue
   assert state['user'] is None and state['current']=='0'
   early=fault in ['permission-denied','none-skip','none-wrong','numeric-skip','numeric-wrong']
   if early:assert expected not in methods
   else:assert methods.count(expected)==1
   count=1 if fault in ['permission-denied','none-skip','none-wrong'] else 2 if fault in ['numeric-skip','numeric-wrong'] else 6 if fault in ['skip','wrong-method'] else 7 if fault in ['transport-skip','transport-wrong'] else 8 if fault in ['cloud-cold-skip','cloud-cold-wrong'] else 9 if fault in ['cloud-warm-skip','cloud-warm-wrong','tap-permission-denied'] else 10
   assert len(methods)==count,(fault,methods)
   assert all(json.loads(p.read_text())['state']=='removed' for p in Path(directory).glob('*ownership.json'))
  print('PASS',variant,fault)

# Execute the production switch helper: am may expose target before UserController settles.
switch_node=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='switch')
switch_code=compile(ast.fix_missing_locations(ast.Module(body=[switch_node],type_ignores=[])),str(source),'exec')
for target,previous in [('0','10'),('10','0')]:
 for fault in ['none','transition','missing','duplicate','unknown','never-settled']:
  observations=[];calls=[]
  def switch_run(*args):
   calls.append(args)
   if args==('shell','am','get-started-user-state','10'):return 'RUNNING_UNLOCKED'
   if args==('shell','am','get-current-user'):return target
   if args==('shell','dumpsys','activity'):
    observations.append(True)
    if fault=='missing':return ''
    if fault=='duplicate':return f'mCurrentUserId:{target}\nmCurrentUserId:{target}\nmTargetUserId:-10000'
    if fault=='unknown':return 'mCurrentUserId:99\nmTargetUserId:-10000'
    if fault=='never-settled' or fault=='transition' and len(observations)<3:return f'mCurrentUserId:{previous}\nmTargetUserId:{target}'
    return f'mCurrentUserId:{target}\nmTargetUserId:-10000'
   assert args==('shell','am','switch-user',target),args
   return ''
  class NoSleep:
   @staticmethod
   def sleep(seconds):assert seconds==.5
  env={'run':switch_run,'owned':lambda run,user,name:None,'re':re,'time':NoSleep}
  exec(switch_code,env)
  failed=False
  try:env['switch'](target,'10','fixture')
  except AssertionError:failed=True
  assert failed==(fault not in ['none','transition']),(target,fault)
  assert len(observations)==(1 if fault=='none' else 3 if fault=='transition' else 30)
  assert sum(c==('shell','am','switch-user',target) for c in calls)==1
  assert not any('stop-user' in c or 'remove-user' in c for c in calls)
  print('PASS settled switch',target,fault)
