import { Capacitor } from "@capacitor/core";
import { secureConnectionStore } from "./native-connection";
import { BrowserJsonDomainDocument } from "../browser/json-domain-document";
import type { CalendarLinkStorage } from "./calendar-linked-store";
const document = (slot: string) => {
	if (!/^calendar-linked-sync:v1:[a-f0-9]{64}$/.test(slot))
		throw Error("Invalid Calendar sync checkpoint slot");
	return new BrowserJsonDomainDocument("alpha.browser." + slot);
};
/** Android checkpoints use encrypted slots; browser checkpoints use transactional documents. */
export const calendarLinkStorage: CalendarLinkStorage = {
	async read(slot) {
		const browser = document(slot);
		return Capacitor.isNativePlatform()
			? secureConnectionStore.read(slot)
			: browser.readJson();
	},
	async compareExchange(slot, expected, value) {
		const browser = document(slot);
		if (
			new TextEncoder().encode(JSON.stringify(value)).length >
			4 * 1024 * 1024
		)
			throw Error("Calendar sync checkpoint limit reached");
		if (Capacitor.isNativePlatform())
			return secureConnectionStore.compareExchange(slot, expected, value);
		let status: "saved" | "conflict" = "conflict";
		await browser.editJson((actual) => {
			if (JSON.stringify(actual) !== JSON.stringify(expected)) return actual;
			status = "saved";
			return value;
		});
		return { status };
	},
};
