'use client';
import Input from '@/components/forms/input';
import Button from '@/components/forms/button';
import { signIn } from '@/services/authService';
import { useUserStore } from '@/store/userStore';
import { useRef } from 'react';

const SignInForm = () => {
  const body = useRef<SingInRequestType>({ username: '', password: '' });
  const setUser = useUserStore((state) => state.setUser);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const user = await signIn(body.current);
    setUser(user);
  };

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-lg space-y-4"
    >
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
        로그인
      </h2>
      <Input
        type="text"
        placeholder="아이디"
        onChange={(e) => (body.current.username = e.target.value)}
        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-400"
      />
      <Input
        type="password"
        placeholder="비밀번호"
        onChange={(e) => (body.current.password = e.target.value)}
        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-400"
      />
      <Button
        type="submit"
        className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition"
      >
        제출
      </Button>
    </form>
  );
};

export default SignInForm;
