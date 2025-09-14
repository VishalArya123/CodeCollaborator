import { useState, useEffect } from 'react';
import { 
  FaUsers, 
  FaComments, 
  FaPhone, 
  FaFolder, 
  FaChevronLeft,
  FaChevronRight,
  FaCog,
  FaBell
} from 'react-icons/fa';
import UserList from './UserList';
import Chat from './Chat';
import FileManager from './FileManager';
import CallSection from './CallSection';

const Sidebar = ({ users, roomId, username }) => {
  const [activeTab, setActiveTab] = useState('users');
  const [width, setWidth] = useState(350);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(width);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [notifications, setNotifications] = useState({
    chat: 0,
    call: 0,
    files: 0
  });

  const handleMouseDown = (e) => {
    if (isCollapsed) return;
    setIsDragging(true);
    setStartX(e.clientX);
    setStartWidth(width);
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDragging || isCollapsed) return;
    const deltaX = e.clientX - startX;
    const newWidth = Math.max(300, Math.min(600, startWidth - deltaX));
    setWidth(newWidth);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, startX, startWidth]);

  const tabs = [
    {
      id: 'users',
      label: 'Team',
      icon: FaUsers,
      count: users.length,
      color: 'text-blue-600 dark:text-blue-400'
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: FaComments,
      count: notifications.chat,
      color: 'text-green-600 dark:text-green-400'
    },
    {
      id: 'call',
      label: 'Call',
      icon: FaPhone,
      count: users.filter(u => u.isInCall).length,
      color: 'text-purple-600 dark:text-purple-400'
    },
    {
      id: 'files',
      label: 'Files',
      icon: FaFolder,
      count: notifications.files,
      color: 'text-orange-600 dark:text-orange-400'
    }
  ];

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const activeTabData = tabs.find(tab => tab.id === activeTab);

  return (
    <div
      className={`bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 flex flex-col relative shadow-xl transition-all duration-300 ${
        isCollapsed ? 'w-16' : ''
      }`}
      style={{ width: isCollapsed ? '64px' : `${width}px` }}
    >
      {!isCollapsed && (
        <div
          className="w-1 bg-slate-200 dark:bg-slate-700 hover:bg-indigo-400 dark:hover:bg-indigo-500 cursor-col-resize absolute h-full left-0 z-10 transition-colors"
          onMouseDown={handleMouseDown}
        />
      )}

      {/* FIXED: Header - reduced padding to save space */}
      <div className="p-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border-b border-slate-200 dark:border-slate-600 flex-shrink-0">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                Workspace
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Collaborate in real-time
              </p>
            </div>
          )}
          
          <button
            onClick={toggleCollapse}
            className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-all duration-200 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <FaChevronLeft className="w-4 h-4" />
            ) : (
              <FaChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* FIXED: Tab Navigation - reduced padding and made more compact */}
      <div className={`border-b border-slate-200 dark:border-slate-700 flex-shrink-0 ${
        isCollapsed ? 'p-1' : 'p-2'
      }`}>
        <div className={`${isCollapsed ? 'space-y-1' : 'grid grid-cols-2 gap-1'}`}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center justify-center p-2 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg transform scale-105'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                } ${isCollapsed ? 'w-10 h-10' : 'h-12'}`}
                title={tab.label}
              >
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-start w-full'}`}>
                  <Icon className={`${isCollapsed ? 'w-4 h-4' : 'w-5 h-5'} ${
                    isActive ? 'text-white' : tab.color
                  }`} />
                  
                  {!isCollapsed && (
                    <div className="ml-2 flex-1">
                      <div className={`font-semibold text-xs ${
                        isActive ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {tab.label}
                      </div>
                      <div className={`text-xs ${
                        isActive ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {tab.id === 'users' 
                          ? `${tab.count} online`
                          : tab.id === 'call'
                            ? `${tab.count} in call`
                            : tab.count > 0 
                              ? `${tab.count} new`
                              : 'Active'
                        }
                      </div>
                    </div>
                  )}
                </div>

                {tab.count > 0 && (tab.id === 'chat' || tab.id === 'files') && (
                  <div className={`absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[16px] h-4 flex items-center justify-center font-bold ${
                    isCollapsed ? 'text-xs px-1' : 'px-1.5'
                  }`}>
                    {tab.count > 99 ? '99+' : tab.count}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* FIXED: Content Area - Made properly scrollable with flex layout */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {!isCollapsed && (
          <>
            {/* FIXED: Section Header - more compact */}
            <div className="p-2 border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {activeTabData && (
                    <>
                      <activeTabData.icon className={`w-4 h-4 ${activeTabData.color}`} />
                      <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                        {activeTabData.label}
                      </h3>
                    </>
                  )}
                </div>
                
                <div className="flex items-center space-x-1">
                  {activeTab === 'chat' && (
                    <button
                      onClick={() => setNotifications(prev => ({ ...prev, chat: 0 }))}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors"
                      title="Mark as read"
                    >
                      <FaBell className="w-3 h-3" />
                    </button>
                  )}
                  
                  <button
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors"
                    title="Settings"
                  >
                    <FaCog className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* FIXED: Scrollable Content Area */}
            <div className="flex-1 overflow-hidden min-h-0">
              {activeTab === 'users' && (
                <div className="h-full">
                  <UserList users={users} currentUsername={username} />
                </div>
              )}
              
              {activeTab === 'chat' && (
                <div className="h-full">
                  <Chat roomId={roomId} username={username} />
                </div>
              )}
              
              {activeTab === 'call' && (
                <div className="h-full">
                  <CallSection roomId={roomId} username={username} />
                </div>
              )}
              
              {activeTab === 'files' && (
                <div className="h-full">
                  <FileManager roomId={roomId} username={username} />
                </div>
              )}
            </div>
          </>
        )}

        {/* Collapsed State */}
        {isCollapsed && (
          <div className="flex-1 flex flex-col items-center justify-center p-2 space-y-4">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <FaUsers className="w-4 h-4 text-white" />
            </div>
            
            <div className="text-center space-y-2">
              <div className="w-6 h-1 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
              <div className="w-8 h-1 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
              <div className="w-4 h-1 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
            </div>
            
            <div className="text-xs text-slate-500 dark:text-slate-400 transform -rotate-90 whitespace-nowrap mt-8">
              Workspace
            </div>
          </div>
        )}
      </div>

      {/* FIXED: Footer - more compact */}
      {!isCollapsed && (
        <div className="p-2 border-t border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Room: <span className="font-mono text-xs">{roomId.substring(0, 8)}...</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 text-xs text-slate-500 dark:text-slate-400">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>{users.length}</span>
              </div>
              
              {users.filter(u => u.isInCall).length > 0 && (
                <div className="flex items-center space-x-1 text-xs text-purple-500">
                  <FaPhone className="w-3 h-3" />
                  <span>{users.filter(u => u.isInCall).length}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collapsed State Notifications */}
      {isCollapsed && (
        <div className="absolute bottom-4 left-4 right-4 space-y-2">
          {users.filter(u => u.isInCall).length > 0 && (
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
              <FaPhone className="w-3 h-3 text-white" />
            </div>
          )}
          
          {notifications.chat > 0 && (
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white text-xs font-bold">
                {notifications.chat > 9 ? '9+' : notifications.chat}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Sidebar;
