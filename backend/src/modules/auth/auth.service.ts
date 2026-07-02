import bcrypt from "bcrypt";
import { AppError } from "@/common/errors/app-error";
import { env } from "@/config/env";
import type { UserRepository } from "@/modules/users/users.repository";
import type { PublicUser } from "@/modules/users/users.types";
import type { LoginInput, RegisterInput } from "./auth.schemas";
import type { RefreshTokenRepository } from "./refresh-token.repository";
import {
  createRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken
} from "./token.service";

export type AuthResult = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};

export type AuthServiceDependencies = {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
};

export class AuthService {
  constructor(private readonly dependencies: AuthServiceDependencies) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = input.email.toLowerCase();
    const existingUser = await this.dependencies.users.findByEmail(email);

    if (existingUser) {
      throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "A user with this email already exists");
    }

    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);
    const user = await this.dependencies.users.createUserWithOrganization({
      email,
      name: input.name,
      passwordHash,
      organizationName: input.organizationName
    });

    return this.issueTokenPair(user);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.dependencies.users.findByEmail(input.email.toLowerCase());

    if (!user) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
    }

    return this.issueTokenPair(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const tokenHash = hashRefreshToken(refreshToken);
    const storedToken = await this.dependencies.refreshTokens.findByHash(tokenHash);

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt <= new Date()) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired");
    }

    const user = await this.dependencies.users.findById(storedToken.userId);

    if (!user) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token user no longer exists");
    }

    await this.dependencies.refreshTokens.revoke(tokenHash);

    return this.issueTokenPair(user);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.dependencies.refreshTokens.revoke(hashRefreshToken(refreshToken));
  }

  async getCurrentUser(accessToken: string): Promise<PublicUser> {
    const payload = verifyAccessToken(accessToken);
    const user = await this.dependencies.users.findById(payload.sub);

    if (!user) {
      throw new AppError(401, "INVALID_TOKEN", "Authenticated user no longer exists");
    }

    return user;
  }

  private async issueTokenPair(user: PublicUser): Promise<AuthResult> {
    const refreshToken = createRefreshToken();
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

    await this.dependencies.refreshTokens.create({
      tokenHash: hashRefreshToken(refreshToken),
      userId: user.id,
      expiresAt
    });

    return {
      user,
      accessToken: signAccessToken({
        sub: user.id,
        email: user.email
      }),
      refreshToken
    };
  }
}
