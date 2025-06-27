type SingInRequestType = {
  username: string;
  password: string;
};
type TokenResponseType = {
  user: UserType;
  token: TokenType;
};

type TokenType = {
  accessToken: string;
  refreshToken: string;
};
