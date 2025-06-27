type UserRoleType = 'ROLE_ADMIN' | 'ROLE_USER';

type UserType = {
  username: string;
  name: string;
  role: UserRoleType;
};
