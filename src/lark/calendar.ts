import { larkClient } from "./client";

export interface CreateEventInput {
  calendarId: string;
  summary: string;
  description?: string;
  startTimestamp: string; // unix seconds, as string
  endTimestamp: string; // unix seconds, as string
  timezone?: string;
}

export async function createCalendarEvent(input: CreateEventInput) {
  const res = await larkClient.calendar.calendarEvent.create({
    path: { calendar_id: input.calendarId },
    data: {
      summary: input.summary,
      description: input.description,
      start_time: { timestamp: input.startTimestamp, timezone: input.timezone ?? "Asia/Ho_Chi_Minh" },
      end_time: { timestamp: input.endTimestamp, timezone: input.timezone ?? "Asia/Ho_Chi_Minh" },
    },
  });
  return res.data?.event;
}
