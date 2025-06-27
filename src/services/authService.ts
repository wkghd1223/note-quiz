export const signIn = async (params: SingInRequestType): Promise<UserType> => {
  const res = await fetch('/api/auth/sign-in', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await res.json();
  const {
    user,
    token: { accessToken },
  } = data;
  localStorage.setItem('token', accessToken);
  return user;
};

export const signOut = async (): Promise<void> => {
  await fetch('/api/auth/sign-out', { method: 'POST' });
};

export const reissue = async (): Promise<UserType | null> => {
  try {
    const res = await fetch('/api/auth/refresh', { method: 'POST' });
    const data = await res.json();
    const {
      user,
      token: { accessToken },
    } = data;
    localStorage.setItem('token', accessToken);
    return user;
  } catch (e) {
    return null;
  }
};
