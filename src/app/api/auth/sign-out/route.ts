import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  (await cookies()).delete('access-token');
  (await cookies()).delete('refresh-token');
  return NextResponse.json({});
}
