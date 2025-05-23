import { useState } from 'react';
import { Link } from 'react-router-dom';

const Header = ({ 
  roomId, 
  activeTab, 
  setActiveTab, 
  toggleSidebar, 
  toggleOutput, 
  copyRoomId, 
  exportCode,
  leaveRoom
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const tabs = [
    { id: 'html', label: 'HTML' },
    { id: 'css', label: 'CSS' },
    { id: 'js', label: 'JavaScript' }
  ];
  
  return (
    <header className="bg-gray-800 text-white shadow-md">
      <div className="container mx-auto flex items-center justify-between px-4 py-2">
        <div className="flex items-center">
          <Link to="/" className="font-bold text-xl mr-8">CodeTogether</Link>
          
          <div className="hidden md:flex space-x-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`px-4 py-2 rounded-t-md ${
                  activeTab === tab.id 
                    ? 'bg-editor-bg text-editor-text' 
                    : 'hover:bg-gray-700'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="hidden md:flex items-center space-x-2">
            <button 
              onClick={toggleOutput}
              className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
            >
              Toggle Output
            </button>
            
            <button 
              onClick={toggleSidebar}
              className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
            >
              Toggle Sidebar
            </button>
            
            <button 
              onClick={copyRoomId}
              className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
              title="Copy room ID to clipboard"
            >
              Room: {roomId.substring(0, 8)}...
            </button>
            
            <button 
              onClick={exportCode}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-sm"
            >
              Export Code
            </button>

            <button 
              onClick={leaveRoom}
              className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-sm text-white"
            >
              Leave Room
            </button>
          </div>
          
          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded hover:bg-gray-700"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
            </svg>
          </button>
        </div>
      </div>
      
      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-gray-800 px-4 py-2 space-y-2 shadow-md">
          <div className="flex space-x-1 mb-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`flex-1 px-3 py-2 rounded ${
                  activeTab === tab.id 
                    ? 'bg-editor-bg text-editor-text' 
                    : 'bg-gray-700'
                }`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsMenuOpen(false);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          <button 
            onClick={() => {
              toggleOutput();
              setIsMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2 rounded bg-gray-700 hover:bg-gray-600"
          >
            Toggle Output
          </button>
          
          <button 
            onClick={() => {
              toggleSidebar();
              setIsMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2 rounded bg-gray-700 hover:bg-gray-600"
          >
            Toggle Sidebar
          </button>
          
          <button 
            onClick={() => {
              copyRoomId();
              setIsMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2 rounded bg-gray-700 hover:bg-gray-600"
          >
            Copy Room ID: {roomId.substring(0, 8)}...
          </button>
          
          <button 
            onClick={() => {
              exportCode();
              setIsMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2 rounded bg-blue-600 hover:bg-blue-700"
          >
            Export Code
          </button>

          <button 
            onClick={() => {
              leaveRoom();
              setIsMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2 rounded bg-red-600 hover:bg-red-700 text-white"
          >
            Leave Room
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;