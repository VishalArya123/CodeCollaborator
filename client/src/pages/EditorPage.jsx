import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { Toaster } from 'react-hot-toast';
import Header from '../components/Header';
import CodeEditor from '../components/CodeEditor';
import OutputWindow from '../components/OutputWindow';
import Sidebar from '../components/Sidebar';
import ConsoleOutput from '../components/ConsoleOutput';

const EditorPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { socket, connected } = useSocket();
  
  const [username, setUsername] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState({
    html: '',
    css: '',
    js: ''
  });
  const [activeTab, setActiveTab] = useState('html');
  const [outputVisible, setOutputVisible] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [layoutMode, setLayoutMode] = useState('split'); // 'split', 'editor-focus', 'output-focus'
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [outputHeight, setOutputHeight] = useState(350);
  const [isFullscreenCode, setIsFullscreenCode] = useState(false);
  const [showFloatingChat, setShowFloatingChat] = useState(false);
  const [notifications, setNotifications] = useState({
    chat: 0,
    call: 0,
    files: 0
  });
  
  const consoleRef = useRef(null);
  
  // Load username from localStorage
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (!storedUsername) {
      navigate('/');
      return;
    }
    setUsername(storedUsername);
  }, [navigate]);

  // Handle socket connection and events
  useEffect(() => {
    if (!socket || !connected || !roomId || !username) return;

    // Join room
    socket.emit('join-room', { roomId, username });

    // Listen for successful room join
    socket.on('room-joined', ({ users: roomUsers, code: initialCode }) => {
      setUsers(roomUsers);
      if (initialCode) {
        setCode(initialCode);
      }
      setLoading(false);
    });

    // Listen for user joined event
    socket.on('user-joined', ({ users: roomUsers }) => {
      setUsers(roomUsers);
    });

    // Listen for user left event
    socket.on('user-left', ({ users: roomUsers }) => {
      setUsers(roomUsers);
    });

    // Listen for code updates
    socket.on('code-update', ({ language, code: newCode }) => {
      setCode(prev => ({
        ...prev,
        [language]: newCode
      }));
    });

    // Listen for chat messages for notifications
    socket.on('chat-message', (message) => {
      if (message.sender !== username && message.sender !== 'system') {
        setNotifications(prev => ({
          ...prev,
          chat: prev.chat + 1
        }));
      }
    });

    // Listen for call events for notifications
    socket.on('user-joined-call', () => {
      setNotifications(prev => ({
        ...prev,
        call: prev.call + 1
      }));
    });

    return () => {
      socket.off('room-joined');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('code-update');
      socket.off('chat-message');
      socket.off('user-joined-call');
    };
  }, [socket, connected, roomId, username, navigate]);

  // Handle code changes
  const handleCodeChange = (value, language) => {
    setCode(prev => ({
      ...prev,
      [language]: value
    }));
    
    // Emit code change to server
    if (socket && connected) {
      socket.emit('code-change', {
        roomId,
        language,
        code: value
      });
    }
  };

  // Layout controls
  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  const toggleOutput = () => {
    setOutputVisible(!outputVisible);
  };

  const setLayout = (mode) => {
    setLayoutMode(mode);
    switch (mode) {
      case 'editor-focus':
        setOutputVisible(false);
        setSidebarVisible(false);
        break;
      case 'output-focus':
        setOutputVisible(true);
        setSidebarVisible(false);
        break;
      case 'split':
      default:
        setOutputVisible(true);
        setSidebarVisible(true);
        break;
    }
  };

  // Copy room ID to clipboard
  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      // Toast notification would be handled by the toast system
    } catch (err) {
      console.error('Failed to copy room ID:', err);
    }
  };

  // Export code
  const exportCode = () => {
    const exportData = {
      html: code.html,
      css: code.css,
      js: code.js,
      metadata: {
        roomId,
        exportedAt: new Date().toISOString(),
        participants: users.map(u => u.username)
      }
    };

    // Create and download JSON file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collaborative-project-${roomId.substring(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Also create individual files
    const files = [
      { content: code.html, name: 'index.html', type: 'text/html' },
      { content: code.css, name: 'styles.css', type: 'text/css' },
      { content: code.js, name: 'script.js', type: 'text/javascript' }
    ];

    files.forEach(file => {
      if (file.content.trim()) {
        const blob = new Blob([file.content], { type: file.type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    });
  };

  // Leave room
  const leaveRoom = () => {
    if (socket && connected) {
      socket.emit('leave-room', { roomId, username });
    }
    localStorage.removeItem('username');
    navigate('/');
  };

  // Execute JavaScript in console
  const executeCode = () => {
    if (consoleRef.current) {
      consoleRef.current.executeCode(code.js, code.html, code.css);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            exportCode();
            break;
          case 'Enter':
            if (activeTab === 'js') {
              e.preventDefault();
              executeCode();
            }
            break;
          case '\\':
            e.preventDefault();
            toggleSidebar();
            break;
          case 'b':
            e.preventDefault();
            toggleOutput();
            break;
          case 'f':
            e.preventDefault();
            setIsFullscreenCode(!isFullscreenCode);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, code, isFullscreenCode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center p-8">
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full animate-pulse mb-4 mx-auto"></div>
            <div className="absolute top-6 left-1/2 transform -translate-x-1/2">
              <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">
            Connecting to workspace
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Setting up your collaborative environment...
          </p>
          <div className="mt-4 text-sm text-slate-500 dark:text-slate-500">
            Room: {roomId.substring(0, 8)}...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900">
      <Toaster 
        position="top-right" 
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--toast-bg)',
            color: 'var(--toast-color)',
          },
        }}
      />
      
      {/* Header */}
      <Header 
        roomId={roomId}
        username={username}
        users={users}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        layoutMode={layoutMode}
        setLayout={setLayout}
        toggleSidebar={toggleSidebar}
        toggleOutput={toggleOutput}
        copyRoomId={copyRoomId}
        exportCode={exportCode}
        executeCode={executeCode}
        leaveRoom={leaveRoom}
        notifications={notifications}
      />
      
      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Code Editor Area */}
        <div className={`flex-1 flex flex-col ${isFullscreenCode ? 'fixed inset-0 z-40 bg-white dark:bg-slate-900' : ''}`}>
          {isFullscreenCode && (
            <div className="p-2 bg-slate-800 text-white flex items-center justify-between">
              <span className="text-sm">Fullscreen Code Editor</span>
              <button
                onClick={() => setIsFullscreenCode(false)}
                className="px-3 py-1 bg-slate-700 rounded text-xs hover:bg-slate-600"
              >
                Exit Fullscreen (Ctrl+F)
              </button>
            </div>
          )}
          
          <CodeEditor
            code={code[activeTab]}
            language={activeTab}
            onChange={(value) => handleCodeChange(value, activeTab)}
            roomId={roomId}
            username={username}
            socket={socket}
          />
          
          {/* Output Window */}
          {outputVisible && !isFullscreenCode && (
            <OutputWindow
              html={code.html}
              css={code.css}
              js={code.js}
              consoleRef={consoleRef}
            />
          )}
        </div>
        
        {/* Sidebar */}
        {sidebarVisible && !isFullscreenCode && (
          <Sidebar
            users={users}
            roomId={roomId}
            username={username}
            notifications={notifications}
            setNotifications={setNotifications}
          />
        )}
      </div>

      {/* Floating Console (when output is hidden) */}
      {!outputVisible && !isFullscreenCode && (
        <div className="fixed bottom-4 right-4 w-96 h-64 bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-30">
          <div className="p-2 bg-slate-800 text-white flex items-center justify-between">
            <span className="text-sm font-medium">Floating Console</span>
            <button
              onClick={() => setOutputVisible(true)}
              className="text-xs text-slate-300 hover:text-white"
            >
              Dock
            </button>
          </div>
          <div className="h-full">
            <ConsoleOutput ref={consoleRef} />
          </div>
        </div>
      )}

      {/* Quick Action Floating Buttons */}
      <div className="fixed bottom-6 left-6 flex flex-col space-y-3 z-20">
        {/* Layout Quick Switch */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-2 border border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 px-1">Layout</div>
          <div className="flex space-x-1">
            {[
              { mode: 'split', icon: '⊞', title: 'Split View' },
              { mode: 'editor-focus', icon: '⊡', title: 'Editor Focus' },
              { mode: 'output-focus', icon: '⊟', title: 'Output Focus' }
            ].map(({ mode, icon, title }) => (
              <button
                key={mode}
                onClick={() => setLayout(mode)}
                className={`w-8 h-8 rounded flex items-center justify-center text-sm transition-colors ${
                  layoutMode === mode
                    ? 'bg-indigo-500 text-white'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
                title={title}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications */}
        {(notifications.chat > 0 || notifications.call > 0) && (
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg shadow-lg p-3">
            <div className="text-xs font-medium mb-2">Notifications</div>
            {notifications.chat > 0 && (
              <div className="text-sm mb-1">{notifications.chat} new messages</div>
            )}
            {notifications.call > 0 && (
              <div className="text-sm">{notifications.call} call updates</div>
            )}
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="fixed top-20 right-4 bg-black/80 text-white text-xs p-3 rounded-lg opacity-0 hover:opacity-100 transition-opacity z-10">
        <div className="font-medium mb-2">Keyboard Shortcuts</div>
        <div className="space-y-1">
          <div>Ctrl+S: Export code</div>
          <div>Ctrl+Enter: Execute JS</div>
          <div>Ctrl+\: Toggle sidebar</div>
          <div>Ctrl+B: Toggle output</div>
          <div>Ctrl+F: Fullscreen editor</div>
        </div>
      </div>
    </div>
  );
};

export default EditorPage;
