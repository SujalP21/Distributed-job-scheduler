import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { AppError } from "@/common/errors/app-error";
import { env } from "@/config/env";

export type AccessTokenPayload = {
  sub: string;
  email: string;
};

export const signAccessToken = (payload: AccessTokenPayload) => {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"]
  };

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);

    if (typeof decoded !== "object" || !decoded.sub || !("email" in decoded)) {
      throw new AppError(401, "INVALID_TOKEN", "Access token payload is invalid");
    }

    return {
      sub: String(decoded.sub),
      email: String(decoded.email)
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(401, "INVALID_TOKEN", "Access token is invalid or expired");
  }
};

export const createRefreshToken = () => crypto.randomBytes(48).toString("base64url");

export const hashRefreshToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");
