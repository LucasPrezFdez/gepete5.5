export type AuthUser = {
  id: string;
  email: string;
  user_metadata: {
    username: string;
    display_name: string;
  };
};

export type AuthSession = {
  access_token: string;
  user: AuthUser;
};
