import { Router } from "express";
import { validateBody } from "@/common/middleware/validate";
import { PrismaUserRepository } from "@/modules/users/users.repository";
import { AuthService } from "./auth.service";
import { authenticate } from "./auth.middleware";
import { PrismaRefreshTokenRepository } from "./refresh-token.repository";
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from "./auth.schemas";

export const createAuthService = () =>
  new AuthService({
    users: new PrismaUserRepository(),
    refreshTokens: new PrismaRefreshTokenRepository()
  });

export const createAuthRouter = (authService = createAuthService()) => {
  const router = Router();

  router.post("/register", validateBody(registerSchema), async (req, res, next) => {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/login", validateBody(loginSchema), async (req, res, next) => {
    try {
      const result = await authService.login(req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/refresh", validateBody(refreshSchema), async (req, res, next) => {
    try {
      const result = await authService.refresh(req.body.refreshToken);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/logout", validateBody(logoutSchema), async (req, res, next) => {
    try {
      await authService.logout(req.body.refreshToken);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", authenticate, async (req, res, next) => {
    try {
      const token = req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      const user = await authService.getCurrentUser(token);
      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
