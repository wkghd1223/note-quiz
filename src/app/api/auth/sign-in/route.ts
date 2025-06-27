import { cookies } from 'next/headers';
import api from '@/lib/api'; // Your Axios instance
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // Body에서 username, password 가져오기
    const { username, password } = await req.json();
    const {
      user,
      token: { accessToken, refreshToken },
    } = await api.post<TokenResponseType>('/v1/auth/sign-in', {
      username,
      password,
    });

    // Set HTTP-only, Secure, and SameSite cookies
    (await cookies()).set('refresh-token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
    (await cookies()).set('access-token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    // Send tokens to client
    return NextResponse.json({ user, token: { accessToken } });
  } catch (error) {
    // Clear tokens if it ran across any error
    return NextResponse.json({ error }, { status: 400 });
  }
}
