import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5001';

const Home = () => {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Create a new room
  const createNewRoom = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${SERVER_URL}/api/rooms/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        localStorage.setItem('username', username);
        navigate(`/editor/${data.roomId}`);
      } else {
        setError(data.message || 'Failed to create room');
      }
    } catch (err) {
      setError('Server error. Please try again.');
      console.error('Error creating room:', err);
    } finally {
      setLoading(false);
    }
  };

  // Join an existing room
  const joinRoom = async (e) => {
    e.preventDefault();
    
    if (!roomId.trim()) {
      setError('Room ID is required');
      return;
    }
    
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${SERVER_URL}/api/rooms/${roomId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.exists) {
        localStorage.setItem('username', username);
        navigate(`/editor/${roomId}`);
      } else {
        setError('Room not found');
      }
    } catch (err) {
      setError('Server error. Please try again.');
      console.error('Error joining room:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">CodeTogether</h1>
          <p className="text-gray-600 text-center">
            Real-time collaborative code editor for developer teams
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Create New Room Form */}
        <form onSubmit={createNewRoom} className="mb-6">
          <div className="mb-4">
            <label htmlFor="username-create" className="block text-gray-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              id="username-create"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create New Room'}
          </button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">OR</span>
          </div>
        </div>

        {/* Join Existing Room Form */}
        <form onSubmit={joinRoom}>
          <div className="mb-4">
            <label htmlFor="roomId" className="block text-gray-700 mb-2">
              Room ID
            </label>
            <input
              type="text"
              id="roomId"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter room ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="username-join" className="block text-gray-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              id="username-join"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-800 text-white py-2 px-4 rounded-md hover:bg-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Joining...' : 'Join Room'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Share the room ID with your team to collaborate in real-time
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;