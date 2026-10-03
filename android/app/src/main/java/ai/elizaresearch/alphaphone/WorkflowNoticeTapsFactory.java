package ai.elizaresearch.alphaphone;
import android.content.Context;
final class WorkflowNoticeTapsFactory {
 static WorkflowNoticeTaps create(Context context){AlphaCredentialStore store=new AlphaCredentialStore(context);return new WorkflowNoticeTaps(new WorkflowNoticeDelivery.Storage(){public String read(String key)throws Exception{return store.readCredentialSlot(key);}public void write(String key,String value)throws Exception{store.writeCredentialSlot(key,value);}});}
}
