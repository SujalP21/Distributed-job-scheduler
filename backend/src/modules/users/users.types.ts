export type PublicUser = {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
};

export type UserWithPassword = PublicUser & {
  passwordHash: string;
};
