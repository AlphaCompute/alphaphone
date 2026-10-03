"""Execute the actual owned phase loop with synthetic command responses; no adb."""
import ast,json,signal,sys,tempfile,uuid,re,subprocess
from pathlib import Path
from recovery_ui_guard import terminal
source=Path(__file__).parent/'pending-recovery-ui.py'
tree=ast.parse(source.read_text());phases=next(n for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='PHASES' for t in n.targets));outer=next(n for n in tree.body if isinstance(n,ast.For) and isinstance(n.target,ast.Name) and n.target.id=='variant');loop=next(n for n in ast.walk(outer) if isinstance(n,ast.For) and isinstance(n.target,ast.Tuple) and n.target.elts[0].id=='phase');code=compile(ast.fix_missing_locations(ast.Module(body=[phases,loop],type_ignores=[])),str(source),'exec')
APP='ai.elizaresearch.alphaphone';TEST=APP+'.test';expected=APP+'.ReminderAgentInstrumentedTest#selectedCrudPersistsExactReceiptsAndRejectsChangedBindings'
for variant in ['standalone','launcher']:
 for fault in ['none','skip','wrong-method','permission-denied']:
  state={'user':None,'current':'0','name':None};calls=[];methods=[]
  def run(*args,**kwargs):
   calls.append(args)
   if args==('shell','pm','list','users'):return 'UserInfo{0:Owner:13}'
   if args[:3]==('shell','pm','create-user'):assert state['user'] is None;state.update(user='10',name=args[3]);return 'Success: created user id 10'
   if args[:3]==('shell','am','get-started-user-state'):return 'RUNNING_UNLOCKED'
   if args[:3]==('shell','pm','grant'):
    assert args[3:6]==('--user','10',APP)
    if args[-1]=='android.permission.POST_NOTIFICATIONS' and fault=='permission-denied':raise RuntimeError('Grant denied')
   if args[:3]==('shell','am','instrument'):
    assert state['current']=='10' and kwargs['timeout']==300
    selector=args[args.index('class')+1];methods.append(selector)
    cls,method=selector.split('#')
    if selector==expected:
     assert ('shell','pm','grant','--user','10',APP,'android.permission.POST_NOTIFICATIONS') in calls
     assert args[args.index('class')+2:args.index('class')+5]==('-e','reminderAgent','1')
     if fault=='wrong-method':method='other'
    start=f'INSTRUMENTATION_STATUS: class={cls}\nINSTRUMENTATION_STATUS: test={method}\nINSTRUMENTATION_STATUS: numtests=1\nINSTRUMENTATION_STATUS_CODE: '
    return start+'1\n'+start+('-3' if selector==expected and fault=='skip' else '0')+'\nINSTRUMENTATION_RESULT: stream=\nOK (1 test)\nINSTRUMENTATION_CODE: -1\n'
   if args[:3]==('shell','pm','remove-user'):assert state['current']=='0';state.update(user=None,name=None)
   return ''
  def owned(run,user,name,current=None):assert user==state['user'] and name==state['name'];assert current is None or state['current']==current
  def switch(target,user,name):owned(run,user,name);state['current']=target
  def guard():assert state['current']=='0'
  def installed(pkg,user,digest):assert user=='10' and digest==variant
  def admit_display(run,user,name,record):owned(run,user,name,user);record({'admitted':True})
  with tempfile.TemporaryDirectory() as directory:
   env=dict(globals(),out=Path(directory),manifest={variant+'-'+k+'.apk':variant for k in ['debug','androidTest']},assert_no_resident=lambda run:None,interrupted=lambda *args:None)
   failed=False
   try:exec(code,env)
   except (AssertionError,RuntimeError):failed=True
   assert failed==(fault!='none'),(variant,fault,failed)
   assert state['user'] is None and state['current']=='0'
   if fault=='permission-denied':assert expected not in methods
   else:assert methods.count(expected)==1
   assert len(methods)==(3 if fault=='permission-denied' else 4)
   assert all(json.loads(p.read_text())['state']=='removed' for p in Path(directory).glob('*ownership.json'))
  print('PASS',variant,fault)
