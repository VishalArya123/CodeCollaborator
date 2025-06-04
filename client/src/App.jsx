import { Routes, Route } from 'react-router-dom';
import { SocketProvider } from './contexts/SocketContext';
import { CallProvider } from './contexts/CallContext'; // Add CallProvider
import Home from './pages/Home';
import EditorPage from './pages/EditorPage';

function App() {
  return (
    <SocketProvider>
      <CallProvider>
        <div className="min-h-screen flex flex-col">
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