import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import Header from '../components/Header';
import CodeEditor from '../components/CodeEditor';
import OutputWindow from '../components/OutputWindow';
import Sidebar from '../components/Sidebar';

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
      setCode(initialCode);
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

    return () => {
      // Clean up event listeners
      socket.off('room-joined');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('code-update');
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

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  // Toggle output visibility
  const toggleOutput = () => {
    setOutputVisible(!outputVisible);
  };

  // Copy room ID to clipboard
  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      alert('Room ID copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy room ID:', err);
    }
  };

  // Download code as ZIP file
  const exportCode = () => {
    // This is a placeholder - you'll need to implement actual ZIP export
    // For hackathon purposes, we'll use a simpler approach
    const htmlBlob = new Blob([code.html], { type: 'text/html' });
    const cssBlob = new Blob([code.css], { type: 'text/css' });
    const jsBlob = new Blob([code.js], { type: 'text/javascript' });
    
    // Create download links
    const htmlURL = URL.createObjectURL(htmlBlob);
    const cssURL = URL.createObjectURL(cssBlob);
    const jsURL = URL.createObjectURL(jsBlob);
    
    // Trigger downloads
    const downloadLink = document.createElement('a');
    
    downloadLink.href = htmlURL;
    downloadLink.download = 'index.html';
    downloadLink.click();
    
    downloadLink.href = cssURL;
    downloadLink.download = 'styles.css';
    downloadLink.click();
    
    downloadLink.href = jsURL;
    downloadLink.download = 'script.js';
    downloadLink.click();
    
    // Clean up
    URL.revokeObjectURL(htmlURL);
    URL.revokeObjectURL(cssURL);
    URL.revokeObjectURL(jsURL);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Connecting to room...</h2>
          <p className="text-gray-600">Please wait while we establish connection</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <Header 
        roomId={roomId}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        toggleSidebar={toggleSidebar}
        toggleOutput={toggleOutput}
        copyRoomId={copyRoomId}
        exportCode={exportCode}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col">
          <CodeEditor
            code={code[activeTab]}
            language={activeTab}
            onChange={(value) => handleCodeChange(value, activeTab)}
            roomId={roomId}
            username={username}
            socket={socket}
          />
          
          {outputVisible && (
            <OutputWindow
              html={code.html}
              css={code.css}
              js={code.js}
            />
          )}
        </div>
        
        {sidebarVisible && (
          <Sidebar
            users={users}
            roomId={roomId}
            username={username}
          />
        )}
      </div>
    </div>
  );
};

export default EditorPage;