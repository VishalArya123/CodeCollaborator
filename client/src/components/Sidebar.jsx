import { useState } from 'react';
import UserList from './UserList';
import Chat from './Chat';

const Sidebar = ({ users, roomId, username }) => {
  const [activeTab, setActiveTab] = useState('users');
  const [width, setWidth] = useState(300);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(width);
  
  // Handle resizing
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.clientX);
    setStartWidth(width);
    e.preventDefault(); // Prevent text selection during drag
  };
  
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const newWidth = Math.max(250, Math.min(500, startWidth - deltaX));
    setWidth(newWidth);
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  return (
    <div 
      className="bg-white border-l border-gray-300 flex flex-col relative"
      style={{ width: `${width}px` }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div 
        className="w-1 bg-gray-200 hover:bg-gray-300 cursor-col-resize absolute h-full left-0 z-10"
        onMouseDown={handleMouseDown}
      ></div>
      
      <div className="flex border-b border-gray-300">
        <button
          className={`flex-1 py-2 text-sm font-medium ${
            activeTab === 'users' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-600 hover:text-gray-800'
          }`}
          onClick={() => setActiveTab('users')}
        >
          Users ({users.length})
        </button>
        <button
          className={`flex-1 py-2 text-sm font-medium ${
            activeTab === 'chat' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-600 hover:text-gray-800'
          }`}
          onClick={() => setActiveTab('chat')}
        >
          Chat
        </button>
      </div>
      
      <div className="flex-1 overflow-hidden">
        {activeTab === 'users' ? (
          <UserList users={users} currentUsername={username} />
        ) : (
          <Chat roomId={roomId} username={username} />
        )}
      </div>
    </div>
  );
};

export default Sidebar;