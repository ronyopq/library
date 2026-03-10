import { eq, sql } from "drizzle-orm";
import type { DbClient } from "../db/client";
import { books } from "../db/schema";

const padSerial = (value: number) => value.toString().padStart(6, "0");

export interface GeneratedCodes {
  accessionCode: string;
  accessionYear: number;
  accessionSerial: number;
  publicSerial: number;
  publicCode: string;
}

export const generateCodes = async (db: DbClient, date = new Date()): Promise<GeneratedCodes> => {
  const year = date.getUTCFullYear();

  const accessionRows = await db
    .select({ maxSerial: sql<number>`COALESCE(MAX(${books.accessionSerial}), 0)` })
    .from(books)
    .where(eq(books.accessionYear, year));

  const publicRows = await db.select({ maxSerial: sql<number>`COALESCE(MAX(${books.publicSerial}), 0)` }).from(books);

  const accessionSerial = Number(accessionRows[0]?.maxSerial ?? 0) + 1;
  const publicSerial = Number(publicRows[0]?.maxSerial ?? 0) + 1;

  return {
    accessionCode: `LIB-${year}-${padSerial(accessionSerial)}`,
    accessionYear: year,
    accessionSerial,
    publicSerial,
    publicCode: `r${publicSerial}`
  };
};
