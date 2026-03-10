import { ZodTypeAny } from "zod";

export const parseWithSchema = <T extends ZodTypeAny>(schema: T, value: unknown) => {
  const result = schema.safeParse(value);
  if (!result.success) {
    return {
      ok: false as const,
      errors: result.error.flatten()
    };
  }

  return {
    ok: true as const,
    data: result.data
  };
};