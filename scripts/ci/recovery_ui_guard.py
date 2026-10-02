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
 # Share the existing 30-observation budget across binding and unlocked readiness.
 # ActivityManager foreground completion precedes asynchronous keyguard user binding.
 admitted=False;consecutive=0;wake_attempts=0;dismissed=False
 for attempt in range(30):
  owned(run,user,name,user)
  assert run('shell','am','get-started-user-state',user).strip()=='RUNNING_UNLOCKED'
  power=run('shell','dumpsys','power');policy=run('shell','dumpsys','window','policy')
  record({'phase':'post-wake' if admitted else 'pre-wake-admission','attempt':attempt,'user':user,'power':power,'policy':policy})
  monitors=re.findall(r'^\s*mCurrentUserId=(\d+)\s*$',policy,re.M)
  delegates=re.findall(r'^\s*currentUser=(-?\d+)\s*$',policy,re.M)
  if not admitted and monitors==['0'] and delegates in (['0'],['-10000']):
   # Only the known previous user/startup sentinel is retryable. Validate every
   # other field strictly; this synthetic binding is never permission to mutate.
   prior=re.sub(r'(?m)^(\s*mCurrentUserId=)0\s*$',lambda m:m[1]+user,policy)
   prior=re.sub(r'(?m)^(\s*currentUser=)(?:0|-10000)\s*$',lambda m:m[1]+user,prior)
   observation(power,prior,user)
  else:
   ready=observation(power,policy,user)
   power_users=re.findall(r'^\s*mUserId=(\d+)\s*$',power,re.M)
   profiles=re.findall(r'^\s*mForegroundProfile=(\d+)\s*$',power,re.M)
   assert len(power_users)==1 and len(profiles)==1,'Power user binding missing or ambiguous'
   # API35 updates main user and interacting-activity profile in separate callbacks.
   # Retry only the known prior/owned transition; never mutate until both bind.
   if not admitted and power_users[0] in ('0',user) and profiles[0] in ('0',user) and (power_users!=[user] or profiles!=[user]):
    sleep(.5);continue
   assert power_users==[user] and profiles==[user],'Power user binding changed or unknown'
   if not admitted:
    owned(run,user,name,user)
    assert run('shell','am','get-started-user-state',user).strip()=='RUNNING_UNLOCKED'
    # Fresh secondary users do not inherit user0's fixture idle policy.
    prior=run('shell','settings','--user',user,'get','system','screen_off_timeout').strip()
    assert re.fullmatch(r'-?\d+|null',prior),'Malformed prior idle setting'
    owned(run,user,name,user)
    run('shell','settings','--user',user,'put','system','screen_off_timeout','2400000')
    assert run('shell','settings','--user',user,'get','system','screen_off_timeout').strip()=='2400000','Owned secondary idle setting not confirmed'
    owned(run,user,name,user)
    record({'phase':'owned-idle-policy','user':user,'priorTimeout':prior,'installedTimeout':'2400000'})
    run('shell','input','keyevent','KEYCODE_WAKEUP')
    wake_attempts=1;admitted=True
   else:
    # Dismiss only after a later authenticated awake/display-on observation.
    # An immediate dismiss during asynchronous wake can leave keyguard showing.
    screen_on=re.findall(r'^\s*screenState=(\w+)\s*$',policy,re.M)
    wakefulness=re.findall(r'^\s*mWakefulness=(\w+)\s*$',power,re.M)
    assert len(screen_on)==1 and len(wakefulness)==1,'Malformed wake/display state'
    if not dismissed and wakefulness==['Awake'] and screen_on==['SCREEN_STATE_ON']:
     owned(run,user,name,user)
     run('shell','wm','dismiss-keyguard');dismissed=True
     sleep(.5);continue
    consecutive=consecutive+1 if dismissed and ready else 0
    if consecutive==2:return
    # An asynchronous user switch can apply an already-expired idle timer after
    # the first wake. Retry only an observed sleep, still bound and unsecured.
    wakefulness=re.findall(r'^\s*mWakefulness=(\w+)\s*$',power,re.M)
    assert len(wakefulness)==1,'Power wakefulness missing or ambiguous'
    if wakefulness[0] in ('Asleep','Dozing') and wake_attempts<2:
     owned(run,user,name,user)
     run('shell','input','keyevent','KEYCODE_WAKEUP')
     wake_attempts+=1
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
