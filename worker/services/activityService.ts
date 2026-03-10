import { activityLogs } from "../db/schema";
import type { DbClient } from "../db/client";

export interface ActivityInput {
  entityType: string;
  entityId: string;
  action: string;
  message: string;
  payload?: Record<string, unknown>;
}

export const logActivity = async (db: DbClient, input: ActivityInput): Promise<void> => {
  await db.insert(activityLogs).values({
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    message: input.message,
    payload: input.payload ? JSON.stringify(input.payload) : null
  });
};