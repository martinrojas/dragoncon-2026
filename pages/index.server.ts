import { defineHandler, type InferProps } from "void";
import { db, desc } from "void/db";
import { messages } from "@schema";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async () => {
  const rows = await db.select().from(messages).orderBy(desc(messages.id));
  return { messages: rows };
});
