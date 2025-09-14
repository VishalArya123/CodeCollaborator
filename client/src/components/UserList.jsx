import { useState, useEffect } from 'react';
import { 
  FaUser,
  FaUserFriends,
  FaMicrophone,
  FaMicrophoneSlash,
  FaPhone,
  FaCode,
  FaEye,
  FaCircle,
  FaKeyboard,
  FaCrown,
  FaUserShield,
  FaSearch,
  FaFilter,
  FaSort
} from 'react-icons/fa';

const UserList = ({ users, currentUsername }) => {
  const [showDetails, setShowDetails] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name', 'joined', 'activity'
  const [filterBy, setFilterBy] = useState('all'); // 'all', 'online', 'in-call', 'typing'
  const [hoveredUser, setHoveredUser] = useState(null);

  // Generate a consistent color for each user based on their username
  const getUserColor = (username) => {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 55%)`;
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

  // Get user status
  const getUserStatus = (user) => {
    if (user.isInCall && user.isSpeaking) return 'speaking';
    if (user.isInCall) return 'in-call';
    if (user.isTyping) return 'typing';
    if (user.disconnectedAt) return 'away';
    return 'online';
  };

  // Get status color and icon
  const getStatusInfo = (status) => {
    switch (status) {
      case 'speaking':
        return { 
          color: 'text-green-500', 
          bgColor: 'bg-green-100 dark:bg-green-900/20',
          icon: FaMicrophone,
          label: 'Speaking'
        };
      case 'in-call':
        return { 
          color: 'text-purple-500', 
          bgColor: 'bg-purple-100 dark:bg-purple-900/20',
          icon: FaPhone,
          label: 'In Call'
        };
      case 'typing':
        return { 
          color: 'text-blue-500', 
          bgColor: 'bg-blue-100 dark:bg-blue-900/20',
          icon: FaKeyboard,
          label: 'Typing'
        };
      case 'away':
        return { 
          color: 'text-yellow-500', 
          bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
          icon: FaCircle,
          label: 'Away'
        };
      default:
        return { 
          color: 'text-green-500', 
          bgColor: 'bg-green-100 dark:bg-green-900/20',
          icon: FaCircle,
          label: 'Online'
        };
    }
  };

  // Get language emoji
  const getLanguageEmoji = (language) => {
    switch (language) {
      case 'html': return '🌐';
      case 'css': return '🎨';
      case 'js': return '⚡';
      default: return '📝';
    }
  };

  // Filter and sort users
  const processedUsers = users
    .filter(user => {
      // Search filter
      if (searchQuery && !user.username.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Status filter
      switch (filterBy) {
        case 'online':
          return !user.disconnectedAt;
        case 'in-call':
          return user.isInCall;
        case 'typing':
          return user.isTyping;
        default:
          return true;
      }
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'joined':
          return new Date(a.joinedAt) - new Date(b.joinedAt);
        case 'activity':
          return new Date(b.lastActive || b.joinedAt) - new Date(a.lastActive || a.joinedAt);
        case 'name':
        default:
          return a.username.localeCompare(b.username);
      }
    });

  // Get time since last activity
  const getTimeSince = (timestamp) => {
    if (!timestamp) return '';
    
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  // Statistics
  const stats = {
    total: users.length,
    online: users.filter(u => !u.disconnectedAt).length,
    inCall: users.filter(u => u.isInCall).length,
    typing: users.filter(u => u.isTyping).length
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-700 border-b border-slate-200 dark:border-slate-600">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <FaUserFriends className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              Team Members
            </h3>
          </div>
          
          <div className="flex items-center space-x-2 text-xs">
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full">
              {stats.online} online
            </span>
            {stats.inCall > 0 && (
              <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full">
                {stats.inCall} in call
              </span>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Filters and Sort */}
          <div className="flex items-center space-x-2">
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
              className="flex-1 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              <option value="all">All Members</option>
              <option value="online">Online</option>
              <option value="in-call">In Call</option>
              <option value="typing">Typing</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="flex-1 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              <option value="name">Sort by Name</option>
              <option value="joined">Sort by Joined</option>
              <option value="activity">Sort by Activity</option>
            </select>
          </div>
        </div>
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto">
        {processedUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <FaUserFriends className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
              {searchQuery ? 'No matching members' : 'No members online'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {searchQuery 
                ? `No team members match "${searchQuery}"`
                : 'Waiting for team members to join...'
              }
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {processedUsers.map((user) => {
              const isCurrentUser = user.username === currentUsername;
              const userStatus = getUserStatus(user);
              const statusInfo = getStatusInfo(userStatus);
              const userColor = getUserColor(user.username);
              
              return (
                <div
                  key={user.id}
                  className={`relative p-3 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                    isCurrentUser 
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' 
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                  onMouseEnter={() => setHoveredUser(user.id)}
                  onMouseLeave={() => setHoveredUser(null)}
                >
                  <div className="flex items-center space-x-3">
                    {/* Avatar */}
                    <div className="relative">
                      <div 
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-lg transition-transform duration-200 ${
                          hoveredUser === user.id ? 'scale-110' : ''
                        }`}
                        style={{ backgroundColor: userColor }}
                      >
                        {getUserInitials(user.username)}
                      </div>
                      
                      {/* Status Indicator */}
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center ${statusInfo.bgColor}`}>
                        <statusInfo.icon className={`w-2 h-2 ${statusInfo.color}`} />
                      </div>

                      {/* Crown for current user */}
                      {isCurrentUser && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                          <FaCrown className="w-2 h-2 text-white" />
                        </div>
                      )}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h4 className={`font-semibold truncate ${
                          isCurrentUser ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'
                        }`}>
                          {user.username}
                        </h4>
                        
                        {isCurrentUser && (
                          <span className="text-xs px-2 py-0.5 bg-indigo-500 text-white rounded-full">
                            You
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2 mt-1">
                        {/* Status */}
                        <span className={`text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                        
                        {/* Language indicator */}
                        {user.language && (
                          <div className="flex items-center space-x-1">
                            <span className="text-xs">{getLanguageEmoji(user.language)}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">
                              {user.language}
                            </span>
                          </div>
                        )}
                      </div>

                      {showDetails && (
                        <div className="mt-2 space-y-1">
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Joined: {getTimeSince(user.joinedAt)}
                          </div>
                          {user.lastActive && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Active: {getTimeSince(user.lastActive)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Icons */}
                    <div className="flex flex-col items-end space-y-2">
                      {/* Mic Status */}
                      {user.isInCall && (
                        <div className={`p-1.5 rounded-full ${
                          user.micEnabled 
                            ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400' 
                            : 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
                        }`}>
                          {user.micEnabled ? (
                            <FaMicrophone className="w-3 h-3" />
                          ) : (
                            <FaMicrophoneSlash className="w-3 h-3" />
                          )}
                        </div>
                      )}

                      {/* Activity Indicators */}
                      <div className="flex items-center space-x-1">
                        {user.isTyping && (
                          <div className="flex space-x-0.5">
                            <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
                            <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                        )}
                        
                        {user.cursor && (
                          <div 
                            className="w-2 h-2 rounded-full animate-pulse"
                            style={{ backgroundColor: userColor }}
                            title={`Cursor in ${user.language} editor`}
                          ></div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details on Hover */}
                  {hoveredUser === user.id && showDetails && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Status:</span>
                          <span className={`ml-1 font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">ID:</span>
                          <span className="ml-1 font-mono text-slate-600 dark:text-slate-300">
                            {user.id.substring(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-600">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
          
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {processedUsers.length} of {users.length} members
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserList;
