import { larkClient } from "./client";

export interface CreateTaskInput {
  summary: string;
  description?: string;
  dueTimestamp?: string; // unix seconds, as string
  isAllDay?: boolean;
}

export async function createTask(input: CreateTaskInput) {
  const res = await larkClient.task.v2.task.create({
    data: {
      summary: input.summary,
      description: input.description,
      due: input.dueTimestamp
        ? { timestamp: input.dueTimestamp, is_all_day: input.isAllDay ?? false }
        : undefined,
    },
  });
  return res.data?.task;
}
