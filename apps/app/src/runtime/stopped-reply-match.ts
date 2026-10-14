/** The send this phone stopped: the clientMessageId it was posted with, plus its text and time. */
export type StoppedTurn = { clientMessageId?: string; text: string; sentAt: number };
/** How far before the local send time an agent clock may stamp the same user row. */
export const STOPPED_TURN_CLOCK_SKEW_MS = 120_000;

/**
 * Finds the user row of a stopped turn in a conversation read (oldest first).
 *
 * Agents from elizaOS/eliza#35907 on return `clientMessageId` on user rows sent with one. When the
 * read carries any such id, the row is matched by id only, so an earlier turn with identical text is
 * never taken for the stopped one, and an unrecorded send matches nothing. Older agents and
 * shared-tier Cloud agents return no ids; for them the last user row with the same restored text
 * sent no earlier than two minutes before the local send time is used, as before.
 */
export function findStoppedUserTurn<T extends Record<string, unknown>>(
	messages: readonly T[],
	turn: StoppedTurn,
	restoredText: (text: string, userTextFormat?: unknown) => string,
): T | undefined {
	const users = messages.filter((item) => item.role === "user").reverse();
	if (turn.clientMessageId && users.some((item) => typeof item.clientMessageId === "string"))
		return users.find((item) => item.clientMessageId === turn.clientMessageId);
	return users.find(
		(item) =>
			typeof item.text === "string" &&
			restoredText(item.text, item.userTextFormat) === turn.text &&
			(typeof item.timestamp !== "number" || item.timestamp >= turn.sentAt - STOPPED_TURN_CLOCK_SKEW_MS),
	);
}
