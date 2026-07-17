import { larkClient } from "./client";

export interface CreateEventInput {
  calendarId: string;
  summary: string;
  description?: string;
  startTimestamp: string; // unix seconds, as string
  endTimestamp: string; // unix seconds, as string
  timezone?: string;
  // open_ids to auto-invite as attendees right after the event is created
  // (e.g. the person who asked the bot to create it) so it shows up on
  // their personal Lark calendar without a manual "add to calendar" step.
  attendeeOpenIds?: string[];
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
  const event = res.data?.event;

  const attendeeOpenIds = [...new Set(input.attendeeOpenIds ?? [])].filter(Boolean);
  if (event?.event_id && attendeeOpenIds.length > 0) {
    await addAttendees(input.calendarId, event.event_id, attendeeOpenIds);
  }

  return event;
}

export async function addAttendees(calendarId: string, eventId: string, userOpenIds: string[]) {
  const res = await larkClient.calendar.calendarEventAttendee.create({
    path: { calendar_id: calendarId, event_id: eventId },
    params: { user_id_type: "open_id" },
    data: {
      attendees: userOpenIds.map((userId) => ({ type: "user" as const, user_id: userId })),
    },
  });
  return res.data?.attendees ?? [];
}
