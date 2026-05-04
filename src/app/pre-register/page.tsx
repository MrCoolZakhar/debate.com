'use client';

import { useRouter } from 'next/navigation';
import PreRegisterModal from '@/components/PreRegisterModal';

export default function PreRegisterPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-[#EDE7D8]">
      <PreRegisterModal open={true} onClose={() => router.push('/')} />
    </div>
  );
}
