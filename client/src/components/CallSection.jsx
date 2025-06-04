import { useEffect, useRef } from 'react';
import { useCall } from '../contexts/CallContext';
import { 
  FaMicrophone, 
  FaMicrophoneSlash, 
  FaVideo, 
  FaVideoSlash,
  FaPhoneSlash,
  FaPhone
} from 'react-icons/fa';

const CallSection = ({ roomId, username }) => {
  const {
    localStream,
    remoteStreams,
    callParticipants,
    isInCall,
    micEnabled,
    videoEnabled,
    startOrJoinCall,
    leaveCall,
    toggleMic,
    toggleVideo,
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef({});

  // Set local video stream with force refresh
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      // Force refresh the video element
      localVideoRef.current.srcObject = null;
      setTimeout(() => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }
      }, 100);
    }
  }, [localStream, videoEnabled]); // Added videoEnabled dependency

  // Set remote video streams with force refresh
  useEffect(() => {
    callParticipants.forEach(participant => {
      if (participant.id !== 'local' && remoteStreams[participant.id]) {
        const videoElement = remoteVideoRefs.current[participant.id];
        if (videoElement) {
          // Force refresh the video element
          videoElement.srcObject = null;
          setTimeout(() => {
            videoElement.srcObject = remoteStreams[participant.id];
          }, 100);
        }
      }
    });
  }, [callParticipants, remoteStreams]);

  // Combined participants (local + remote) - Show all participants
  const allParticipants = [
    { 
      id: 'local',
      username: `${username} (You)`,
      stream: localStream,
      micEnabled,
      videoEnabled,
      isLocal: true
    },
    ...callParticipants.map(p => ({
      ...p,
      stream: remoteStreams[p.id],
      isLocal: false
    }))
  ].filter(p => p.stream || p.isLocal); // Show local even without stream, others only with streams

  // Calculate grid layout based on participant count
  const getGridLayout = (count) => {
    if (count === 1) return { cols: 1, rows: 1 };
    if (count === 2) return { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    if (count <= 9) return { cols: 3, rows: 3 };
    return { cols: 4, rows: Math.ceil(count / 4) };
  };

  const { cols, rows } = getGridLayout(allParticipants.length);

  return (
    <div className="flex flex-col h-full">
      {/* Video Grid */}
      <div className="flex-1 overflow-y-auto p-2">
        <div 
          className="grid gap-2 h-full"
          style={{ 
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            minHeight: '200px'
          }}
        >
          {allParticipants.map(participant => (
            <div 
              key={participant.id} 
              className="relative bg-gray-800 rounded-lg overflow-hidden min-h-[150px]"
            >
              {participant.videoEnabled && participant.stream ? (
                <video
                  ref={participant.isLocal ? 
                    localVideoRef : 
                    (el) => {
                      if (el) {
                        remoteVideoRefs.current[participant.id] = el;
                      }
                    }
                  }
                  autoPlay
                  playsInline
                  muted={participant.isLocal}
                  className="w-full h-full object-cover"
                  key={`${participant.id}-${participant.videoEnabled}`} // Force re-render on video toggle
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-700">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gray-600 flex items-center justify-center text-white text-lg md:text-2xl">
                    {participant.username.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
              
              <div className="absolute bottom-2 left-2 text-white text-xs md:text-sm bg-black bg-opacity-50 px-2 py-1 rounded max-w-[80%] truncate">
                {participant.username}
              </div>
              
              <div className="absolute top-2 right-2 flex space-x-1">
                <span className={`p-1 rounded-full ${participant.micEnabled ? 'bg-green-500' : 'bg-red-500'}`}>
                  {participant.micEnabled ? <FaMicrophone size={10} /> : <FaMicrophoneSlash size={10} />}
                </span>
                <span className={`p-1 rounded-full ${participant.videoEnabled ? 'bg-green-500' : 'bg-red-500'}`}>
                  {participant.videoEnabled ? <FaVideo size={10} /> : <FaVideoSlash size={10} />}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Call Controls */}
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="flex justify-center space-x-4">
          <button
            onClick={toggleMic}
            className={`p-3 rounded-full transition-colors ${micEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'} text-white`}
            aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
            disabled={!isInCall}
          >
            {micEnabled ? <FaMicrophone size={20} /> : <FaMicrophoneSlash size={20} />}
          </button>
          
          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full transition-colors ${videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'} text-white`}
            aria-label={videoEnabled ? 'Turn off video' : 'Turn on video'}
            disabled={!isInCall}
          >
            {videoEnabled ? <FaVideo size={20} /> : <FaVideoSlash size={20} />}
          </button>
          
          {isInCall ? (
            <button
              onClick={() => leaveCall(roomId)}
              className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
              aria-label="Leave call"
            >
              <FaPhoneSlash size={20} />
            </button>
          ) : (
            <button
              onClick={() => startOrJoinCall(roomId)}
              className="p-3 bg-green-600 hover:bg-green-700 text-white rounded-full transition-colors"
              aria-label="Join call"
            >
              <FaPhone size={20} />
            </button>
          )}
        </div>
        
        {/* Participant count indicator */}
        {isInCall && allParticipants.length > 0 && (
          <div className="text-center text-gray-400 text-sm mt-2">
            {allParticipants.length} participant{allParticipants.length !== 1 ? 's' : ''} in call
          </div>
        )}
      </div>
    </div>
  );
};

export default CallSection;