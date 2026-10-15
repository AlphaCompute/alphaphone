import type {
	LinkedCalendarLocalPort,
	LinkedCalendarLocalSnapshot,
	LinkedCalendarSemanticEvent,
} from "../../../../.eliza/client-features/packages/contracts/src/calendar-linked-sync";
import {
	calendarDocument,
	initialCalendarState,
	type BrowserCalendarState,
} from "./calendar-store";
import {
	calendarRecord,
	replaceCalendarRecord,
	type CalendarRecord,
} from "./calendar-records";
import {
	calendarDeletionPending,
	stageCalendarDeletion,
} from "./calendar-deletions";
import {
	browserDeletionOwner,
	browserDeletionOwnerCurrent,
} from "../runtime/deletion-owner";
import { revision } from "./revision";

function semantic(row: CalendarRecord): LinkedCalendarSemanticEvent {
	if (
		row.calendarId !== "local" ||
		!row.revision ||
		!Number.isFinite(row.begin) ||
		!Number.isFinite(row.end) ||
		row.end <= row.begin
	)
		throw Error("This local event needs recovery before syncing.");
	// Recurrence and contact-id translation must be wired before these events can
	// enter sync. Never flatten a series or turn local contact IDs into email addresses.
	if (
		row.seriesId ||
		(row.repeat && row.repeat !== "none") ||
		row.excluded?.length ||
		row.who?.length
	)
		throw Error(
			"This event needs recurrence or attendee sync support. Nothing changed.",
		);
	if (row.allDay && (row.begin % 86400000 !== 0 || row.end % 86400000 !== 0))
		throw Error("The all-day event dates need review.");
	const timeZone = row.allDay
		? null
		: row.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
	if (timeZone) new Intl.DateTimeFormat("en-US", { timeZone }).format();
	return {
		title: row.title,
		description: row.body,
		location: row.location,
		startAt: row.allDay
			? new Date(row.begin).toISOString().slice(0, 10)
			: new Date(row.begin).toISOString(),
		endAt: row.allDay
			? new Date(row.end).toISOString().slice(0, 10)
			: new Date(row.end).toISOString(),
		timeZone,
		isAllDay: !!row.allDay,
		attendees: [],
	};
}
/** Real browser calendar storage, with the same source/revision and Undo guards as manual edits.
 * The controller must supply its current, explicitly enabled owner/Google binding. */
export function browserCalendarSyncPort(
	sourceRevision: string,
	current: () => boolean,
): LinkedCalendarLocalPort<string> {
	const check = (data?: BrowserCalendarState) => {
		if (!current() || (data && data.sourceRevision !== sourceRevision))
			throw new DOMException("Calendar sync source changed", "AbortError");
	};
	const selected = (data: BrowserCalendarState, id: string) => {
		check(data);
		const row = calendarRecord(data.events, id);
		if (row && calendarDeletionPending(data, id))
			throw Error(
				"This event has a pending deletion. Finish or undo it before syncing.",
			);
		return row;
	};
	const snapshot = (
		row: CalendarRecord,
	): LinkedCalendarLocalSnapshot<string> => ({
		eventId: row.id,
		revision: row.revision,
		event: semantic(row),
	});
	return {
		async get(id) {
			check();
			const data = await calendarDocument.read(initialCalendarState);
			check(data);
			const row = selected(data, id);
			return row ? snapshot(row) : null;
		},
		async applyProviderEvent(id, event, expectedRevision) {
			check();
			const begin = Date.parse(event.startAt),
				end = Date.parse(event.endAt);
			if (
				!event.title.trim() ||
				event.title.length > 4000 ||
				!Number.isFinite(begin) ||
				!Number.isFinite(end) ||
				end <= begin ||
				event.deleted ||
				event.attendees.length ||
				("recurrence" in event && event.recurrence)
			)
				throw Error(
					"This Google event cannot be represented locally without losing fields. Nothing changed.",
				);
			if (
				event.isAllDay &&
				(!/^\d{4}-\d{2}-\d{2}$/.test(event.startAt) ||
					!/^\d{4}-\d{2}-\d{2}$/.test(event.endAt))
			)
				throw Error("Review whole all-day dates before syncing.");
			if (!event.isAllDay && !event.timeZone)
				throw Error(
					"The Google event timezone must be known before applying it locally.",
				);
			if (event.timeZone)
				new Intl.DateTimeFormat("en-US", { timeZone: event.timeZone }).format();
			const result = await calendarDocument.edit(
				initialCalendarState,
				(data) => {
					const before = selected(data, id);
					if (!before || before.revision !== expectedRevision)
						throw Error("The local event changed before sync could apply.");
					semantic(before);
					const next = {
						...before,
						title: event.title,
						body: event.description,
						location: event.location,
						begin,
						end,
						allDay: event.isAllDay,
						...(!event.isAllDay && event.timeZone
							? { timeZone: event.timeZone }
							: {}),
						revision: revision(),
					};
					const result = snapshot(next);
					replaceCalendarRecord(data.events, next);
					return result;
				},
			);
			check();
			window.dispatchEvent(new Event("alpha:calendar-document-changed"));
			return result;
		},
		async delete(id, expectedRevision) {
			check();
			const owner = browserDeletionOwner();
			await calendarDocument.edit(initialCalendarState, (data) => {
				const before = selected(data, id);
				if (!before) return;
				if (
					before.revision !== expectedRevision ||
					!browserDeletionOwnerCurrent(owner)
				)
					throw Error("The local event or owner changed before deletion.");
				semantic(before);
				stageCalendarDeletion(data, before, "event", owner);
			});
			check();
			window.dispatchEvent(new Event("alpha:deletions-changed"));
			window.dispatchEvent(new Event("alpha:calendar-document-changed"));
		},
	};
}
