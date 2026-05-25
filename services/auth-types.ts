export type AuthUser = {
  id: string;
  email: string;
  isAdmin: boolean;
  bannedUntil: string | null;
  user_metadata: {
    username: string;
    display_name: string;
  };
};

export type AuthSession = {
  access_token: string;
  user: AuthUser;
};
