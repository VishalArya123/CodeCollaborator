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

  // Set local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Set remote video streams
  useEffect(() => {
    callParticipants.forEach(participant => {
      const videoElement = remoteVideoRefs.current[participant.id];
      if (videoElement && remoteStreams[participant.id]) {
        videoElement.srcObject = remoteStreams[participant.id];
      }
    });
  }, [callParticipants, remoteStreams]);

  // Combined participants (local + remote)
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
  ].filter(p => p.stream); // Only show participants with streams

  return (
    <div className="flex flex-col h-full">
      {/* Video Grid - Fixed 3 slots */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {allParticipants.slice(0, 3).map(participant => (
          <div key={participant.id} className="relative bg-gray-800 rounded-lg" style={{ height: '30vh' }}>
            {participant.videoEnabled ? (
              <video
                ref={participant.isLocal ? localVideoRef : (el) => remoteVideoRefs.current[participant.id] = el}
                autoPlay
                playsInline
                muted={participant.isLocal}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-700">
                <div className="w-20 h-20 rounded-full bg-gray-600 flex items-center justify-center text-white text-2xl">
                  {participant.username.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
            
            <div className="absolute bottom-2 left-2 text-white text-sm bg-black bg-opacity-50 px-2 py-1 rounded">
              {participant.username}
            </div>
            
            <div className="absolute top-2 right-2 flex space-x-1">
              <span className={`p-1 rounded-full ${participant.micEnabled ? 'bg-green-500' : 'bg-red-500'}`}>
                {participant.micEnabled ? <FaMicrophone size={12} /> : <FaMicrophoneSlash size={12} />}
              </span>
              <span className={`p-1 rounded-full ${participant.videoEnabled ? 'bg-green-500' : 'bg-red-500'}`}>
                {participant.videoEnabled ? <FaVideo size={12} /> : <FaVideoSlash size={12} />}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Call Controls */}
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="flex justify-center space-x-4">
          <button
            onClick={toggleMic}
            className={`p-3 rounded-full ${micEnabled ? 'bg-gray-700' : 'bg-red-600'} text-white`}
          >
            {micEnabled ? <FaMicrophone size={20} /> : <FaMicrophoneSlash size={20} />}
          </button>
          
          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full ${videoEnabled ? 'bg-gray-700' : 'bg-red-600'} text-white`}
          >
            {videoEnabled ? <FaVideo size={20} /> : <FaVideoSlash size={20} />}
          </button>
          
          {isInCall ? (
            <button
              onClick={() => leaveCall(roomId)}
              className="p-3 bg-red-600 text-white rounded-full"
            >
              <FaPhoneSlash size={20} />
            </button>
          ) : (
            <button
              onClick={() => startOrJoinCall(roomId)}
              className="p-3 bg-green-600 text-white rounded-full"
            >
              <FaPhone size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallSection;