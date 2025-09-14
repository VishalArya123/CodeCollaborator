import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { SocketProvider } from './contexts/SocketContext';
import { CallProvider } from './contexts/CallContext'; 
import Home from './pages/Home';
import EditorPage from './pages/EditorPage';

function App() {
  return (
    <SocketProvider>
      <CallProvider>
        <div className="min-h-screen flex flex-col">
        <Toaster position="top-right" />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/editor/:roomId" element={<EditorPage />} />
          </Routes>
        </div>
      </CallProvider>
    </SocketProvider>
  );
}

export default App;