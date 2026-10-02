"""Read-only supervised command fixture: admission, strict transcript, and refusal flows."""
from recovery_ui_guard import owned,admit_display,terminal
USER='10';NAME='alpha-recovery-'+'a'*32
POLICY='''KeyguardServiceDelegate
 currentUser=10
 secure=false
 showing=false
 inputRestricted=false
 systemIsReady=true
 bootCompleted=true
 screenState=SCREEN_STATE_ON
 KeyguardStateMonitor
 mCurrentUserId=10
 mIsShowing=false
 mInputRestricted=false
'''
class Fixture:
 def __init__(self,policy=POLICY,user='10',name=NAME):self.policy=policy;self.user=user;self.name=name;self.effects=[]
 def run(self,*args):
  key=' '.join(args)
  if key=='shell pm list users':return 'Users:\n UserInfo{0:Owner:13}\n UserInfo{10:'+self.name+':10}'
  if key=='shell am get-current-user':return self.user
  if key=='shell am get-started-user-state 10':return 'RUNNING_UNLOCKED'
  if key=='shell dumpsys power':return 'mWakefulness=Awake'
  if key=='shell dumpsys window policy':return self.policy
  if key in ('shell input keyevent KEYCODE_WAKEUP','shell wm dismiss-keyguard'):self.effects.append(key);return ''
  raise AssertionError('Unexpected fixture command '+key)
def refused(work):
 try:work()
 except AssertionError:return
 raise AssertionError('Unsafe case accepted')
f=Fixture();admit_display(f.run,USER,NAME,sleep=lambda _:None);assert len(f.effects)==2
for policy in [POLICY.replace('secure=false','secure=true'),POLICY.replace('mCurrentUserId=10','mCurrentUserId=0'),POLICY+' secure=false\n',POLICY.replace('mInputRestricted=false','')]:
 f=Fixture(policy=policy);refused(lambda:admit_display(f.run,USER,NAME,sleep=lambda _:None));assert not f.effects
f=Fixture(user='0');refused(lambda:admit_display(f.run,USER,NAME,sleep=lambda _:None));assert not f.effects
f=Fixture(name='other-user');refused(lambda:owned(f.run,USER,NAME));assert not f.effects
f=Fixture(policy=POLICY.replace('showing=false','showing=true'));refused(lambda:admit_display(f.run,USER,NAME,sleep=lambda _:None));assert len(f.effects)==2
cls='ai.elizaresearch.alphaphone.Fixture';method='exactMethod'
block=lambda code:'INSTRUMENTATION_STATUS: class='+cls+'\nINSTRUMENTATION_STATUS: test='+method+'\nINSTRUMENTATION_STATUS: numtests=1\nINSTRUMENTATION_STATUS_CODE: '+str(code)+'\n'
text=block(1)+block(0)+'OK (1 test)\nINSTRUMENTATION_CODE: -1\n';terminal(text,cls,method)
for bad in [text.replace('STATUS_CODE: 0','STATUS_CODE: -3'),text+block(0),text.replace(method,'other'),text.replace('numtests=1','numtests=2'),text.replace('OK (1 test)','OK (0 tests)'),text.replace('INSTRUMENTATION_CODE: -1','INSTRUMENTATION_CODE: 0'),text+'INSTRUMENTATION_FAILED: crash\n']:
 refused(lambda:terminal(bad,cls,method))
print('PASS: owned-secondary ready flow; secure/wrong-user/malformed/timeout refusal; exact transcript acceptance and seven failure classes')
