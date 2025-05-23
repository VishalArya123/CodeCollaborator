import { useState } from 'react';

const UserList = ({ users, currentUsername }) => {
  const [showDetails, setShowDetails] = useState(false);

  // Generate a color for each user based on their username
  const getUserColor = (username) => {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  };

  // Get user initials
  const getUserInitials = (username) => {
    return username
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-800">Online Users</h3>
        <span className="text-sm text-gray-500">{users.length} online</span>
      </div>

      <div className="space-y-3">
        {users.map((user) => (
          <div
            key={user.id}
            className={`flex items-center space-x-3 p-2 rounded-lg ${
              user.username === currentUsername 
                ? 'bg-blue-50 border border-blue-200' 
                : 'hover:bg-gray-50'
            }`}
          >
            {/* User Avatar */}
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
              style={{ backgroundColor: getUserColor(user.username) }}
            >
              {getUserInitials(user.username)}
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.username}
                  {user.username === currentUsername && (
                    <span className="text-xs text-blue-600 ml-1">(You)</span>
                  )}
                </p>
                
                {/* Online Status */}
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                </div>
              </div>
              
              {showDetails && (
                <p className="text-xs text-gray-500 truncate">
                  ID: {user.id.substring(0, 8)}...
                </p>
              )}
            </div>

            {/* User Status/Activity */}
            <div className="flex items-center">
              {user.isTyping && (
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {users.length === 0 && (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">No users online</p>
        </div>
      )}

      {/* Toggle Details Button */}
      {users.length > 0 && (
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="mt-4 w-full text-xs text-gray-500 hover:text-gray-700 py-2"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      )}
    </div>
  );
};

export default UserList;