'use client';
import { useManage } from '@/app/manage/[slug]/layout';

export default function ApplicationsPage() {
  const { conference } = useManage();
  return (
    <div className="px-6 md:px-10 py-8">
      <p className="text-xs font-mono tracking-widest mb-2" style={{ color: '#9A8A78' }}>
        {conference?.acronym} / Applications
      </p>
      <h1 className="text-2xl font-black mb-2" style={{ color: '#1C1410' }}>Applications</h1>
      <p className="text-sm" style={{ color: '#9A8A78' }}>This section is being built. Check back soon.</p>
    </div>
  );
}
