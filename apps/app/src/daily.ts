import type {ReminderOperation,ReminderTarget,ReminderResult} from './runtime/reminder-contract';
import { registerPlugin } from './platform-plugins';
import { type PluginListenerHandle } from '@capacitor/core';
export type Action =
  | "camera"
  | "photos"
  | "files"
  | "maps"
  | "calendar"
  | "calendar-create"
  | "email"
  | "inbox"
  | "browser"
  | "notifications"
  | "settings"
  | "reminder"
  | "voice"
  | "autofill"
  | "phone"
  | "messages"
  | "contacts";
export type Reminder = {
  target?: ReminderTarget;
  id: string;
  title: string;
  body: string;
  at: number;
  status: "scheduled" | "posted" | "completed" | "cancelled" | "permission-denied" | "scheduling-failed";
  mode: "inexact";
  createdAt: number;
  occurrenceId?: string;
  dueAt?: number;
  snoozedAt?: number;
  recurrence?: {rule: "daily"|"weekdays"|"weekly";zone:string;date:string;time:string;leadMinutes:number};
  history?: {occurrenceId:string;dueAt:number;completedAt:number;skippedDates:number}[];
  postedAt?: number;
  cancelledAt?: number;
  completedAt?: number;
};
export type NativeResult = {
  status: "opened" | "selected" | "renamed-reselect" | "cancelled" | "unavailable" | "failed";
  action: Action;
  message?: string;
  selectionId?: string;
  uri?: string;
  name?: string;
  mimeType?: string;
  transcript?: string;
};
export type ClockRequest = {action:'set';hour:number;minute:number;label:string;reviewed:true} | {action:'show'|'dismiss';reviewed:true} | {action:'snooze';snoozeMinutes:number;reviewed:true};
export type ClockResult = {action:ClockRequest['action'];status:'opened'|'unavailable'|'denied'|'failed'|'unknown';message:string};
export const DailyApps = registerPlugin<{
  clockHandoff(options:ClockRequest):Promise<ClockResult>;
  surfaceInfo(): Promise<{ developmentBuild: boolean; assistant: boolean; bottomInset?: number; topInset?: number }>;
  closeAssistant(): Promise<{ closed: boolean }>;
  addListener(
    event: "appResumed",
    callback: (result: Record<string, never>) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "assistantInvoked",
    callback: (result: { source: "android-assist"; surface: "assistant" }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "restoredResult",
    callback: (result: NativeResult) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "reminderOpened",
    callback: (result: { id: string; occurrenceId?: string }) => void,
  ): Promise<PluginListenerHandle>;
  restoreSelected(): Promise<NativeResult>;
  renameSelected(options: { selectionId: string; name: string }): Promise<NativeResult>;
  pdfSelected(options: { selectionId: string; page: number }): Promise<{status:string; message?:string; page?:number; pageCount?:number; imageUri?:string}>;
  readSelected(options: {
    selectionId: string;
  }): Promise<{
    status: string;
    text?: string;
    mimeType?: string;
    bytes?: number;
    message?: string;
  }>;
  openSelected(options: {
    selectionId: string;
  }): Promise<{ status: string; message?: string }>;
  shareSelected(options: { selectionId: string }): Promise<{ status: string; message?: string }>;
  forgetSelected(options: { selectionId: string }): Promise<void>;
  scheduleReminder(options: {
    id: string;
    title: string;
    body?: string;
    at: number;
    recurrence?: Reminder["recurrence"];
  }): Promise<{
    status: "scheduled" | "permission-denied" | "past" | "failed";
    id: string;
    mode: "inexact";
    message?: string;
  }>;
  selectedReminder(options:{id:string}):Promise<ReminderTarget>;
  operateReminder(options:{operationId:string;bindingHash:string;operation:ReminderOperation}):Promise<{status:string;result?:ReminderResult;message?:string}>;
  reminderOperationReceipt(options:{operationId:string;bindingHash:string;operation:ReminderOperation}):Promise<{status:string;result?:ReminderResult;message?:string}>;
  reminderDecision(options:{id:string;occurrenceId:string;action:"done"|"snooze"}):Promise<{status:string;message?:string}>;
  listReminders(): Promise<{
    reminders: Reminder[];
    notificationsEnabled: boolean;
  }>;
  /** Compatibility alias; ID-only cancellation is refused. */
  cancelReminder(options: {
    id: string; target: ReminderTarget; operationId: string; bindingHash: string;
  }): Promise<{ status: "cancelled" | "unknown"; id: string }>;
  capabilities(): Promise<{
    platform: string;
    actions: { action: Action; available: boolean; mode: string }[];
  }>;
  perform(options: {
    action: Action;
    query?: string;
    title?: string;
    body?: string;
    url?: string;
    startTime?: number;
    endTime?: number;
  }): Promise<NativeResult>;
}>("DailyApps");
export type Note = {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
};
export type Workflow = {
  id: string;
  title: string;
  steps: {
    view: string;
    title: string;
    state: "pending" | "opened" | "done";
  }[];
  createdAt: string;
};
export type Receipt = {
  id: string;
  action: string;
  status: string;
  message: string;
  at: string;
};
export type LocalData = {
  version: 1;
  notes: Note[];
  workflows: Workflow[];
  receipts: Receipt[];
};
const KEY = "alphaphone:daily:v1";
export const emptyData = (): LocalData => ({
  version: 1,
  notes: [],
  workflows: [],
  receipts: [],
});
export function loadData(): LocalData {
  const raw = localStorage.getItem(KEY);
  if (!raw) return emptyData();
  const data = JSON.parse(raw);
  const text = (v: unknown): v is string => typeof v === "string";
  const record = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object";
  const date = (v: unknown) => text(v) && Number.isFinite(Date.parse(v));
  const note = (v: unknown) =>
    record(v) &&
    text(v.id) &&
    text(v.title) &&
    text(v.body) &&
    date(v.updatedAt);
  const step = (v: unknown) =>
    record(v) &&
    text(v.view) &&
    ["Calendar", "Notes", "Reminders"].includes(v.view) &&
    text(v.title) &&
    ["pending", "opened", "done"].includes(String(v.state));
  const workflow = (v: unknown) =>
    record(v) &&
    text(v.id) &&
    text(v.title) &&
    date(v.createdAt) &&
    Array.isArray(v.steps) &&
    v.steps.every(step);
  const receipt = (v: unknown) =>
    record(v) &&
    text(v.id) &&
    text(v.action) &&
    text(v.status) &&
    text(v.message) &&
    date(v.at);
  if (
    !record(data) ||
    data.version !== 1 ||
    !Array.isArray(data.notes) ||
    !data.notes.every(note) ||
    !Array.isArray(data.workflows) ||
    !data.workflows.every(workflow) ||
    !Array.isArray(data.receipts) ||
    !data.receipts.every(receipt)
  )
    throw new Error(
      "Stored data cannot be read. Export it before clearing app storage.",
    );
  return data as unknown as LocalData;
}
export function saveData(data: LocalData) {
  localStorage.setItem(KEY, JSON.stringify(data));
}
