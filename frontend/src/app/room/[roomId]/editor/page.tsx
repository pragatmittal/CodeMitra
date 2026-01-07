'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { SocketProvider } from '@/lib/socket';
import CollaborativeEditor from '@/components/editor/CollaborativeEditor';

export default function RoomEditorPage({ params }: { params: { roomId: string } }) {
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

<<<<<<< HEAD
  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Error Joining Room</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={handleJoinRoom}
              disabled={isJoining}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isJoining ? 'Joining...' : 'Retry'}
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Room not found state
  if (!currentRoom || currentRoom.id !== roomId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full">
          <h2 className="text-xl font-semibold mb-4">Joining Room...</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Attempting to join room...</p>
          <button
            onClick={handleJoinRoom}
            disabled={isJoining}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isJoining ? 'Joining...' : 'Join Room'}
          </button>
        </div>
      </div>
    );
  }

  console.log(`📄📄📄 RoomEditorPage: Rendering with roomId param="${roomId}", currentRoom.id="${currentRoom.id}", user="${user?.name}"`);
  
=======
>>>>>>> 300446fa250e6096c7b559e094fa5460547acb15
  return (
    <SocketProvider>
      <CollaborativeEditor roomId={params.roomId} />
    </SocketProvider>
  );
}

