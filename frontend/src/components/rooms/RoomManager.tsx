import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useSocket } from '@/lib/socket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, Code2, Globe, Lock, Clock, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Room {
  id: string;
  name: string;
  description?: string;
  language: string;
  visibility: boolean;
  maxCapacity: number;
  creator: { id: string; name: string };
  participants: Array<{ user: { id: string; name: string } }>;
  _count: { participants: number };
  createdAt: string;
  lastActivity: string;
}

export default function RoomManager() {
  const { user, token } = useAuth();
  const { socket, isConnected } = useSocket();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRoom, setNewRoom] = useState({
    name: '',
    description: '',
    language: 'javascript',
    visibility: true,
    password: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');

  const fetchRooms = useCallback(async () => {
    try {
      if (!searchTerm && !selectedLanguage) {
        setLoading(true);
      } else {
        setSearching(true);
      }
      
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedLanguage) params.append('language', selectedLanguage);
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/rooms?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      if (data.success) {
        setRooms(data.data.rooms);
      } else {
        toast.error(data.error || 'Failed to fetch rooms');
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
      toast.error('Failed to fetch rooms');
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, [searchTerm, selectedLanguage, token]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Auto-search when search term or language changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm || selectedLanguage) {
        setSearching(true);
      }
      fetchRooms();
    }, 300); // Debounce search by 300ms

    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedLanguage, fetchRooms]);

  // Listen for real-time room updates
  useEffect(() => {
    if (socket && isConnected) {
      socket.on('room:created', (room: Room) => {
        toast.success(`New room "${room.name}" created!`);
        setRooms(prev => [room, ...prev]);
      });
      socket.on('room:deleted', ({ roomId }: { roomId: string }) => {
        toast('A room was deleted');
        setRooms(prev => prev.filter(room => room.id !== roomId));
      });

      socket.on('room:updated', (updatedRoom: Room) => {
        setRooms(prev => prev.map(room => 
          room.id === updatedRoom.id ? updatedRoom : room
        ));
      });

      // Listen for user count updates in rooms
      socket.on('user:count:update', (data) => {
        console.log('[DASHBOARD] User count update:', data);
        setRooms(prev => prev.map(room => 
          room.id === data.roomId 
            ? { ...room, _count: { participants: data.count } }
            : room
        ));
      });

      return () => {
        socket.off('room:created');
        socket.off('room:deleted');
        socket.off('room:updated');
        socket.off('user:count:update');
      };
    }
  }, [socket, isConnected]);

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Disable button to prevent double-clicks
    const submitButton = e.currentTarget.querySelector('button[type="submit"]') as HTMLButtonElement;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Creating...';
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/rooms`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newRoom)
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success('Room created successfully! Redirecting...');
        
        // Reset form state
        setShowCreateForm(false);
        setNewRoom({ name: '', description: '', language: 'javascript', visibility: true, password: '' });
        
        // Update local state to mark user as in room
        // This prevents the "Already in room" error when they try to join
        const roomId = data.data.id;
        
        // Navigate to the room editor immediately
        window.location.href = `/room/${roomId}/editor`;
      } else {
        toast.error(data.error || 'Failed to create room');
      }
    } catch (error) {
      console.error('Failed to create room:', error);
      toast.error('Failed to create room');
    } finally {
      // Re-enable button
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Create Room';
      }
    }
  };

  const joinRoom = async (roomId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      });
      
      const data = await response.json();
      if (data.success) {
        // Check if we have a redirect URL in the response
        const redirectUrl = data.data?.redirectUrl || `/room/${roomId}/editor`;
        
        if (data.message === 'Already in room - redirecting to editor') {
          toast.success('You are already in this room! Redirecting...');
        } else {
          toast.success('Joined room successfully!');
        }
        
        // Navigate to the room
        window.location.href = redirectUrl;
      } else {
        toast.error(data.error || 'Failed to join room');
      }
    } catch (error) {
      console.error('Failed to join room:', error);
      toast.error('Failed to join room');
    }
  };

  const getLanguageIcon = (language: string) => {
    const icons = {
      javascript: '⚡',
      python: '🐍',
      java: '☕',
      cpp: '⚙️'
    };
    return icons[language as keyof typeof icons] || '📝';
  };

  const getLanguageColor = (language: string) => {
    const colors = {
      javascript: 'bg-yellow-500',
      python: 'bg-green-500',
      java: 'bg-orange-500',
      cpp: 'bg-blue-500'
    };
    return colors[language as keyof typeof colors] || 'bg-gray-500';
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSelectedLanguage('');
  };

  const hasActiveFilters = searchTerm || selectedLanguage;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-white">Available Rooms</h2>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Code2 className="w-4 h-4 mr-2" />
          Create Room
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search rooms by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <select
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 min-w-[140px]"
        >
          <option value="">All Languages</option>
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
        </select>
        
        {hasActiveFilters && (
          <Button onClick={clearSearch} variant="outline" className="whitespace-nowrap">
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Create Room Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Room</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createRoom} className="space-y-4">
              <Input
                placeholder="Room name"
                value={newRoom.name}
                onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                required
              />
              <Input
                placeholder="Description (optional)"
                value={newRoom.description}
                onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
              />
              <select
                value={newRoom.language}
                onChange={(e) => setNewRoom({ ...newRoom, language: e.target.value })}
                className="w-full p-2 border rounded-md"
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newRoom.visibility}
                  onChange={(e) => setNewRoom({ ...newRoom, visibility: e.target.checked })}
                  className="rounded"
                />
                <label className="text-sm">Public room</label>
              </div>
              {!newRoom.visibility && (
                <Input
                  type="password"
                  placeholder="Room password"
                  value={newRoom.password}
                  onChange={(e) => setNewRoom({ ...newRoom, password: e.target.value })}
                  required
                />
              )}
              <div className="flex space-x-2">
                <Button type="submit">Create Room</Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Rooms List */}
      <div className="grid gap-4">
        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-white">Loading rooms...</p>
            </CardContent>
          </Card>
        ) : searching ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-white">Searching rooms...</p>
            </CardContent>
          </Card>
        ) : rooms.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Code2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              {hasActiveFilters ? (
                <div>
                  <p className="text-white mb-2">No rooms found matching your search</p>
                  <Button onClick={clearSearch} variant="outline" size="sm">
                    Clear filters
                  </Button>
                </div>
              ) : (
                <p className="text-white">No rooms available</p>
              )}
            </CardContent>
          </Card>
        ) : (
          rooms.map((room) => (
            <Card key={room.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-semibold text-lg text-white">{room.name}</h3>
                      <Badge className={`${getLanguageColor(room.language)} text-white`}>
                        {getLanguageIcon(room.language)} {room.language}
                      </Badge>
                      {!room.visibility && (
                        <Badge variant="secondary">
                          <Lock className="w-3 h-3 mr-1" />
                          Private
                        </Badge>
                      )}
                    </div>
                    
                    {room.description && (
                      <p className="text-white text-sm mb-3">{room.description}</p>
                    )}
                    
                    <div className="flex items-center space-x-4 text-sm text-white">
                      <div className="flex items-center space-x-1">
                        <Users className="w-4 h-4" />
                        <span>{room._count.participants}/{room.maxCapacity}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>{new Date(room.lastActivity).toLocaleDateString()}</span>
                      </div>
                      <span>by {room.creator.name}</span>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={() => joinRoom(room.id)}
                    disabled={room._count.participants >= room.maxCapacity}
                  >
                    {room._count.participants >= room.maxCapacity ? 'Full' : 'Join Room'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
