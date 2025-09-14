import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FaCode, 
  FaUsers, 
  FaPhone, 
  FaComments, 
  FaFolder,
  FaCopy,
  FaDownload,
  FaPlay,
  FaExpand,
  FaCompress,
  FaSignOutAlt,
  FaBars,
  FaTimes,
  FaBell,
  FaChevronDown,
  FaSun,
  FaMoon,
  FaCog
} from 'react-icons/fa';

const Header = ({ 
  roomId,
  username,
  users,
  activeTab, 
  setActiveTab, 
  layoutMode,
  setLayout,
  toggleSidebar, 
  toggleOutput, 
  copyRoomId, 
  exportCode,
  executeCode,
  leaveRoom,
  notifications = { chat: 0, call: 0, files: 0 }
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const navigate = useNavigate();
  
  const tabs = [
    { id: 'html', label: 'HTML', color: 'text-orange-500', icon: '🌐' },
    { id: 'css', label: 'CSS', color: 'text-blue-500', icon: '🎨' },
    { id: 'js', label: 'JavaScript', color: 'text-yellow-500', icon: '⚡' }
  ];

  const layouts = [
    { id: 'split', label: 'Split View', icon: '⊞' },
    { id: 'editor-focus', label: 'Editor Focus', icon: '⊡' },
    { id: 'output-focus', label: 'Output Focus', icon: '⊟' }
  ];

  // Check dark mode preference
  useEffect(() => {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    setIsDarkMode(darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode);
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Handle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Copy room ID with feedback
  const handleCopyRoomId = async () => {
    try {
      await copyRoomId();
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy room ID:', error);
    }
  };

  // Handle leave room with confirmation
  const handleLeaveRoom = () => {
    if (window.confirm('Are you sure you want to leave this collaboration room?')) {
      leaveRoom();
    }
  };

  // Total notifications count
  const totalNotifications = Object.values(notifications).reduce((sum, count) => sum + count, 0);

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm relative z-30">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-4">
            <Link 
              to="/" 
              className="flex items-center space-x-2 group"
            >
              <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                <FaCode className="w-5 h-5 text-white" />
              </div>
              <div className="hidden md:block">
                <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                  CodeTogether
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Collaborative IDE
                </p>
              </div>
            </Link>

            {/* Room Info */}
            <div className="hidden lg:flex items-center space-x-3 pl-4 border-l border-slate-200 dark:border-slate-700">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Room: <span className="font-mono font-medium">{roomId.substring(0, 8)}...</span>
                </span>
              </div>
              
              <div className="flex items-center space-x-1 text-sm text-slate-500 dark:text-slate-400">
                <FaUsers className="w-3 h-3" />
                <span>{users.length} online</span>
              </div>
            </div>
          </div>

          {/* Language Tabs - Desktop */}
          <div className="hidden md:flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id 
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm transform scale-105' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
                {activeTab === tab.id && (
                  <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                )}
              </button>
            ))}
          </div>

          {/* Actions and Controls */}
          <div className="flex items-center space-x-2">
            {/* Quick Actions - Desktop */}
            <div className="hidden lg:flex items-center space-x-2">
              {/* Layout Selector */}
              <select
                value={layoutMode}
                onChange={(e) => setLayout(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {layouts.map(layout => (
                  <option key={layout.id} value={layout.id}>
                    {layout.icon} {layout.label}
                  </option>
                ))}
              </select>

              {/* Execute Button */}
              {activeTab === 'js' && (
                <button 
                  onClick={executeCode}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md text-xs font-medium transition-colors"
                  title="Execute JavaScript (Ctrl+Enter)"
                >
                  <FaPlay className="w-3 h-3" />
                  <span>Run</span>
                </button>
              )}

              {/* Copy Room ID */}
              <button 
                onClick={handleCopyRoomId}
                className="flex items-center space-x-1 px-3 py-1.5 bg-slate-500 hover:bg-slate-600 text-white rounded-md text-xs font-medium transition-colors"
                title="Copy room ID"
              >
                <FaCopy className="w-3 h-3" />
                <span className="hidden xl:inline">Copy ID</span>
              </button>

              {/* Export Code */}
              <button 
                onClick={exportCode}
                className="flex items-center space-x-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-xs font-medium transition-colors"
                title="Export project (Ctrl+S)"
              >
                <FaDownload className="w-3 h-3" />
                <span className="hidden xl:inline">Export</span>
              </button>
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                title="Notifications"
              >
                <FaBell className="w-4 h-4" />
                {totalNotifications > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {totalNotifications > 9 ? '9+' : totalNotifications}
                  </div>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50">
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
                      Notifications
                    </h3>
                    
                    {totalNotifications > 0 ? (
                      <div className="space-y-2">
                        {notifications.chat > 0 && (
                          <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-md">
                            <div className="flex items-center space-x-2">
                              <FaComments className="w-4 h-4 text-green-600 dark:text-green-400" />
                              <span className="text-sm text-green-700 dark:text-green-300">
                                {notifications.chat} new messages
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {notifications.call > 0 && (
                          <div className="flex items-center justify-between p-2 bg-purple-50 dark:bg-purple-900/20 rounded-md">
                            <div className="flex items-center space-x-2">
                              <FaPhone className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              <span className="text-sm text-purple-700 dark:text-purple-300">
                                {notifications.call} call updates
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {notifications.files > 0 && (
                          <div className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-900/20 rounded-md">
                            <div className="flex items-center space-x-2">
                              <FaFolder className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                              <span className="text-sm text-orange-700 dark:text-orange-300">
                                {notifications.files} file updates
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                        No new notifications
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Settings Menu */}
            <div className="hidden md:flex items-center space-x-2">
              {/* Dark Mode Toggle */}
              <button
                onClick={toggleDarkMode}
                className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDarkMode ? <FaSun className="w-4 h-4" /> : <FaMoon className="w-4 h-4" />}
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? <FaCompress className="w-4 h-4" /> : <FaExpand className="w-4 h-4" />}
              </button>
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-3 pl-3 border-l border-slate-200 dark:border-slate-700">
              <div className="hidden md:flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="hidden lg:block">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {username}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Collaborator
                  </div>
                </div>
              </div>

              {/* Leave Room */}
              <button 
                onClick={handleLeaveRoom}
                className="flex items-center space-x-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-md text-xs font-medium transition-colors"
                title="Leave room"
              >
                <FaSignOutAlt className="w-3 h-3" />
                <span className="hidden md:inline">Leave</span>
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? (
                <FaTimes className="w-5 h-5" />
              ) : (
                <FaBars className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-slate-200 dark:border-slate-700">
            {/* Language Tabs - Mobile */}
            <div className="flex space-x-1 mt-4 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.id 
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsMenuOpen(false);
                  }}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Mobile Actions */}
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => {
                    handleCopyRoomId();
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center justify-center space-x-2 px-3 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-md text-sm"
                >
                  <FaCopy className="w-4 h-4" />
                  <span>Copy ID</span>
                </button>

                <button 
                  onClick={() => {
                    exportCode();
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center justify-center space-x-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm"
                >
                  <FaDownload className="w-4 h-4" />
                  <span>Export</span>
                </button>
              </div>

              {activeTab === 'js' && (
                <button 
                  onClick={() => {
                    executeCode();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm"
                >
                  <FaPlay className="w-4 h-4" />
                  <span>Execute JavaScript</span>
                </button>
              )}

              {/* Layout Selection - Mobile */}
              <div className="mt-3">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                  Layout Mode
                </label>
                <select
                  value={layoutMode}
                  onChange={(e) => {
                    setLayout(e.target.value);
                    setIsMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  {layouts.map(layout => (
                    <option key={layout.id} value={layout.id}>
                      {layout.icon} {layout.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Room Info - Mobile */}
              <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Room ID: <span className="font-mono">{roomId.substring(0, 8)}...</span>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {users.length} collaborators online
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close notifications */}
      {showNotifications && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowNotifications(false)}
        ></div>
      )}
    </header>
  );
};

export default Header;
