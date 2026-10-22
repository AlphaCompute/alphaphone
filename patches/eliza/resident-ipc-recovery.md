# Resident IPC recovery is upstream

The recovery implementation from elizaOS/eliza#37009 was consumed without a
consumer patch at pin `5c36344786274ce1a0b0e2ebcb560bc2da6ac0ab`.
The current pin `3d6f68a129702a1a2779cc087c93a80ba0f2332e` is its reviewed
successor from elizaOS/eliza#37198. It repairs launch/stop ordering in
ElizaAgentService, IpcStartupRecovery and WorkflowSurvivorInventory. The source
admission test binds all three files to the reviewed hashes; it does not assert
that the earlier service/recovery bytes are unchanged.

Native staging consumes the pinned sources directly. The redundant consumer
patch and special patch slot remain removed. Single-use recovery confirmation,
intact archive and interrupted-archive refusal retain their existing authority.

Earlier component and device evidence remains historical. The new source review
and regression tests do not establish new installed-device recovery or acceptance.
