"""Strict owned-secondary display and instrumentation admission; no device defaults."""
import re,time

def owned(run,user,name,foreground=None):
 assert re.fullmatch(r'[1-9][0-9]*',user) and re.fullmatch(r'alpha-recovery-[a-f0-9]{32}',name)
 text=run('shell','pm','list','users')
 rows=re.findall(r'UserInfo\{(\d+):([^:}]+):[^}]+\}',text)
 assert len(rows)==2 and set(n for n,_ in rows)=={'0',user}
 assert [label for n,label in rows if n==user]==[name]
 if foreground is not None:assert run('shell','am','get-current-user').strip()==foreground

def observation(power,policy,user):
 values=lambda p:re.findall(p,policy,re.M)
 monitors=values(r'^\s*mCurrentUserId=(\d+)\s*$');delegates=values(r'^\s*currentUser=(-?\d+)\s*$')
 assert monitors==[user] and delegates==[user] and len(values(r'^\s*KeyguardStateMonitor\s*$'))==1,'Display user binding missing or ambiguous'
 secure=values(r'^\s*secure=(true|false)\s*$');show=values(r'^\s*(?:showing|mIsShowing)=(true|false)\s*$');restricted=values(r'^\s*(?:inputRestricted|mInputRestricted)=(true|false)\s*$')
 assert secure==['false'],'Credential security is not known false'
 assert len(show)==2 and len(restricted)==2,'Malformed display state'
 ready=bool(re.search(r'^\s*systemIsReady=true\s*$',policy,re.M) and re.search(r'^\s*bootCompleted=true\s*$',policy,re.M))
 assert ready,'Display service not ready'
 return bool(re.search(r'^\s*mWakefulness=Awake\s*$',power,re.M) and re.search(r'^\s*screenState=SCREEN_STATE_ON\s*$',policy,re.M) and show==['false','false'] and restricted==['false','false'])

def admit_display(run,user,name,sleep=time.sleep,record=lambda x:None):
 owned(run,user,name,user)
 assert run('shell','am','get-started-user-state',user).strip()=='RUNNING_UNLOCKED'
 # No policy mutation before exact bound, unsecured observation.
 power=run('shell','dumpsys','power');policy=run('shell','dumpsys','window','policy')
 record({'phase':'pre-wake-admission','user':user,'power':power,'policy':policy})
 observation(power,policy,user)
 owned(run,user,name,user)
 run('shell','input','keyevent','KEYCODE_WAKEUP');run('shell','wm','dismiss-keyguard')
 consecutive=0
 for attempt in range(30):
  owned(run,user,name,user)
  assert run('shell','am','get-started-user-state',user).strip()=='RUNNING_UNLOCKED'
  power=run('shell','dumpsys','power');policy=run('shell','dumpsys','window','policy')
  record({'attempt':attempt,'user':user,'power':power,'policy':policy})
  consecutive=consecutive+1 if observation(power,policy,user) else 0
  if consecutive==2:return
  sleep(.5)
 raise AssertionError('Owned secondary display readiness timed out')

def terminal(text,cls,method):
 blocks=re.findall(r'((?:INSTRUMENTATION_STATUS: [^\n]*\n)+)INSTRUMENTATION_STATUS_CODE: (-?\d+)\s*(?:\n|$)',text)
 assert len(blocks)==2 and [code for _,code in blocks]==['1','0'],'Require one start and one pass, no skipped/duplicate results'
 for block,_ in blocks:
  for field,expected in [('class',cls),('test',method),('numtests','1')]:assert re.findall(r'^INSTRUMENTATION_STATUS: '+field+r'=(.*)$',block,re.M)==[expected]
 assert re.findall(r'^INSTRUMENTATION_CODE: (-?\d+)\s*$',text,re.M)==['-1']
 assert len(re.findall(r'^OK \(1 test\)\s*$',text,re.M))==1
 assert not re.search(r'FAILURES|INSTRUMENTATION_FAILED|INSTRUMENTATION_ABORTED|AssumptionViolated|INSTRUMENTATION_STATUS: (?:Error|stack)=',text)
