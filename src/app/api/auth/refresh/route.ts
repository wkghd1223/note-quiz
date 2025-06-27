import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import api from '@/lib/api'; // Your Axios instance

export async function POST() {
  try {
    // 쿠키에서 토큰을 뽑아온다.
    const prevAccessToken = (await cookies()).get('access-token')?.value;
    const prevRefreshToken = (await cookies()).get('refresh-token')?.value;
    if (!prevAccessToken || !prevRefreshToken) {
      // Stop if there's no token
      return NextResponse.json({});
    }
    // 쿠키에서 가져온 토큰으로 reissue API 호출
    const {
      user,
      token: { accessToken, refreshToken },
    } = await api.post<TokenResponseType>('/v1/auth/reissue', {
      accessToken: prevAccessToken,
      refreshToken: prevRefreshToken,
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
    (await cookies()).delete('access-token');
    (await cookies()).delete('refresh-token');
    return NextResponse.json({ error }, { status: 401 });
  }
}
