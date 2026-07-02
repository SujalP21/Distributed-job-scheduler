import type { RequestHandler } from "express";
import type { ZodSchema } from "zod";

export const validateBody =
  <TBody>(schema: ZodSchema<TBody>): RequestHandler =>
  (req, _res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
