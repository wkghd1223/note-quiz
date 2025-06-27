'use client';
import SignInForm from '@/components/pages/auth/sign-in-form';
import Modal from '@/components/ui/modal';
import { useUserStore } from '@/store/userStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SignInModal() {
  const _prepared = useUserStore((state) => state._prepared);
  const user = useUserStore((state) => state.user);
  const router = useRouter();
  useEffect(() => {
    if (_prepared && user) {
      router.replace('/');
    }
  }, [_prepared, user]);
  if (!_prepared) {
    return null;
  }
  if (_prepared && user) {
    return null;
  }
  return (
    <Modal isPage>
      <SignInForm />
    </Modal>
  );
}
