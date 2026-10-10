import test from 'node:test';
// The incoming PR's manual-chat entry tests describe the P-01/P-07 requirement, but main
// now uses ongoing Cloud conversation. Keep the unmet acceptance visible rather than
// treating the incompatible manual fixture as proof of product behavior. The current
// entry/retirement behavior is exercised by chat-cloud-voice and voice-owned-navigation.
for (const view of ['Home', 'Calendar', 'Notes']) {
  test.todo(`PRD P-01/P-07: reviewed voice draft from ${view}, explicit send, source-bound latency marks`);
}
test.todo('PRD manual voice: discarding the recording abandons its latency record');
