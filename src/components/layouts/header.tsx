'use client';
import useAuthToken from '@/hooks/useAuthToken';
import { useUserStore } from '@/store/userStore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from '@/services/authService';
import { HiOutlineBell } from 'react-icons/hi';
import { FaUserCircle } from 'react-icons/fa';
import { FRONT_URL_PATH } from '@/lib/constants';
import { getFileUrl } from '@/lib/file';
import Image from 'next/image';
import { GiGreekTemple } from 'react-icons/gi';

const navs = [
  { href: FRONT_URL_PATH.DASHBOARD, text: '대시보드' },
  { href: FRONT_URL_PATH.NOTICE, text: '공지사항' },
];

const Header = () => {
  const user = useUserStore((state) => state.user);
  const clearUser = useUserStore((state) => state.clearUser);

  const router = useRouter();

  const onClickSignIn = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(FRONT_URL_PATH.SIGNIN);
  };

  const onClickSignOut = async (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    await signOut();
    localStorage.removeItem('token');
    clearUser();
  };

  useAuthToken();

  return (
    <header className="flex justify-between items-center mr-4 ml-4 mb-4">
      <nav className="flex items-center">
        <Link
          className="flex items-center space-x-2 m-4 cursor-pointer"
          href="/"
        >
          <Image
            src="/globe.svg"
            alt="Logo"
            className="w-12 h-12"
            width={12}
            height={12}
          />
        </Link>
        <ul className="flex space-x-6">
          {navs.map((nav, navKey) => (
            <li
              className="text-gray-700 font-medium"
              key={`HEADER_NAV_${navKey}`}
            >
              <Link href={nav.href}>{nav.text}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex items-center space-x-4">
        <Link href="/suggest">
          <GiGreekTemple />
        </Link>
        <HiOutlineBell className="text-xl text-gray-600" />
        {user ? (
          <div className="flex items-center">
            <span className="mr-2 mt-1">{user.name}</span>
            <button onClick={onClickSignOut}>
              <FaUserCircle className="text-2xl text-gray-600" />
            </button>
          </div>
        ) : (
          <div className="signin">
            <button onClick={onClickSignIn}>로그인</button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
