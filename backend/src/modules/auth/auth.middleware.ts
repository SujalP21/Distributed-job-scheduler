import type { RequestHandler } from "express";
import { AppError } from "@/common/errors/app-error";
import { verifyAccessToken } from "./token.service";

export type AuthenticatedUserContext = {
  id: string;
  email: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUserContext;
    }
  }
}

export const authenticate: RequestHandler = (req, _res, next) => {
  try {
    const header = req.header("authorization");
    const [scheme, token] = header?.split(" ") ?? [];

    if (scheme !== "Bearer" || !token) {
      throw new AppError(401, "UNAUTHORIZED", "Bearer access token is required");
    }

    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email
    };

    next();
  } catch (error) {
    next(error);
  }
};
