'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { SocketProvider } from '@/lib/socket';
import CollaborativeEditor from '@/components/editor/CollaborativeEditor';

export default function RoomEditorPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SocketProvider>
      <CollaborativeEditor roomId={roomId} />
    </SocketProvider>
  );
}

