import React from 'react';
import { useCall } from '../contexts/CallContext';
import { 
  FaMicrophone, 
  FaMicrophoneSlash, 
  FaPhone, 
  FaPhoneSlash, 
  FaChevronLeft, 
  FaChevronRight,
  FaVolumeUp,
  FaVolumeDown,
  FaSpinner,
  FaExclamationTriangle
} from 'react-icons/fa';

const CallSection = ({ roomId, username }) => {
  const {
    callParticipants,
    isInCall,
    micEnabled,
    isSpeaking,
    speakingUsers,
    callError,
    isInitializing,
    usesFallbackMode,
    currentPage,
    PAGE_SIZE,
    startOrJoinCall,
    leaveCall,
    toggleMic,
    nextPage,
    prevPage,
  } = useCall();

  // Combined participants (local + remote)
  const allParticipants = [
    {
      id: 'local',
      username: `${username} (You)`,
      micEnabled,
      isSpeaking,
      isLocal: true,
    },
    ...callParticipants.map(p => ({
      ...p,
      isSpeaking: speakingUsers[p.id] || false,
      isLocal: false,
    })),
  ];

  const paginatedParticipants = allParticipants.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );

  const totalPages = Math.ceil(allParticipants.length / PAGE_SIZE);

  const getGridLayout = (count) => {
    if (count === 1) return { cols: 1, rows: 1, gap: 'gap-4' };
    if (count === 2) return { cols: 2, rows: 1, gap: 'gap-3' };
    if (count <= 4) return { cols: 2, rows: 2, gap: 'gap-2' };
    return { cols: 2, rows: 2, gap: 'gap-2' };
  };

  const { cols, rows, gap } = getGridLayout(paginatedParticipants.length);

  const getUserColor = (username) => {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 55%)`;
  };

  const getUserInitials = (username) => {
    return username
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
      {/* FIXED: Header - made more compact and scrollable friendly */}
      <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
              <FaPhone className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                Audio Call
              </h3>
              <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
                <span>
                  {isInCall 
                    ? `${allParticipants.length} participant${allParticipants.length !== 1 ? 's' : ''}`
                    : 'Not in call'
                  }
                </span>
                {usesFallbackMode && isInCall && (
                  <>
                    <span>•</span>
                    <span className="text-yellow-600 dark:text-yellow-400">Basic Mode</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {isInCall && (
            <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Connected</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {callError && (
        <div className="mx-3 mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-3 flex-shrink-0">
          <FaExclamationTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-300">{callError}</p>
          </div>
        </div>
      )}

      {/* FIXED: Participants Grid - Made properly scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-3">
          {isInCall && paginatedParticipants.length > 0 ? (
            <>
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2 mb-4">
                  <button
                    onClick={prevPage}
                    disabled={currentPage === 0}
                    className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <FaChevronLeft className="w-3 h-3" />
                  </button>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {currentPage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={nextPage}
                    disabled={currentPage >= totalPages - 1}
                    className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <FaChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              <div
                className={`grid ${gap} auto-rows-fr`}
                style={{
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  minHeight: '200px'
                }}
              >
                {paginatedParticipants.map(participant => (
                  <div
                    key={participant.id}
                    className={`relative bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-lg border-2 transition-all duration-300 ${
                      participant.isSpeaking 
                        ? 'border-green-400 dark:border-green-500 shadow-green-100 dark:shadow-green-900/20 scale-105' 
                        : 'border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    {participant.isSpeaking && (
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 animate-pulse"></div>
                    )}
                    
                    <div className="relative h-full flex flex-col items-center justify-center p-4 min-h-[120px]">
                      <div className="relative mb-3">
                        <div
                          className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-white text-xl md:text-2xl font-bold shadow-lg transition-all duration-300 ${
                            participant.isSpeaking 
                              ? 'bg-gradient-to-br from-green-500 to-emerald-600 scale-110' 
                              : participant.isLocal 
                                ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                                : 'bg-gradient-to-br from-slate-500 to-slate-600'
                          }`}
                        >
                          {getUserInitials(participant.username)}
                        </div>

                        {/* FIXED: Voice Activity Indicator */}
                        {participant.isSpeaking && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                            <FaVolumeUp className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>

                      <div className="text-center mb-2">
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-full text-sm">
                          {participant.username}
                        </h4>
                      </div>

                      {/* FIXED: Enhanced Microphone Status */}
                      <div className="flex items-center space-x-2">
                        <div className={`p-2 rounded-full transition-all duration-200 ${
                          participant.micEnabled 
                            ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400' 
                            : 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
                        }`}>
                          {participant.micEnabled ? (
                            <FaMicrophone className="w-3 h-3" />
                          ) : (
                            <FaMicrophoneSlash className="w-3 h-3" />
                          )}
                        </div>

                        {/* Connection Quality Indicator */}
                        {!participant.isLocal && (
                          <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400">
                            <FaVolumeUp className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      {/* Mute Status Label */}
                      {!participant.micEnabled && (
                        <div className="mt-2 px-2 py-1 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-full">
                          Muted
                        </div>
                      )}

                      {/* Fallback Mode Indicator */}
                      {usesFallbackMode && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 text-xs rounded-full">
                          Basic
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : !isInCall ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center p-8">
                <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <FaPhone className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                </div>
                <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
                  No Active Call
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto">
                  Start an audio call to collaborate with your team in real-time
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center p-8">
                <FaSpinner className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400">
                  Connecting to call...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FIXED: Call Controls - Enhanced with better feedback */}
      <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-sm flex-shrink-0">
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={toggleMic}
            disabled={!isInCall || isInitializing}
            className={`p-4 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 ${
              micEnabled 
                ? 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300' 
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
            aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            {micEnabled ? (
              <FaMicrophone className="w-5 h-5" />
            ) : (
              <FaMicrophoneSlash className="w-5 h-5" />
            )}
          </button>

          {isInCall ? (
            <button
              onClick={() => leaveCall(roomId)}
              disabled={isInitializing}
              className="p-4 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
              aria-label="Leave call"
            >
              {isInitializing ? (
                <FaSpinner className="w-5 h-5 animate-spin" />
              ) : (
                <FaPhoneSlash className="w-5 h-5" />
              )}
            </button>
          ) : (
            <button
              onClick={() => startOrJoinCall(roomId)}
              disabled={isInitializing}
              className="p-4 bg-green-500 hover:bg-green-600 text-white rounded-full transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
              aria-label="Join call"
            >
              {isInitializing ? (
                <FaSpinner className="w-5 h-5 animate-spin" />
              ) : (
                <FaPhone className="w-5 h-5" />
              )}
            </button>
          )}
        </div>

        {/* Call Status Info */}
        <div className="mt-3 text-center">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isInCall ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>
                  Call active • {allParticipants.length} participant{allParticipants.length !== 1 ? 's' : ''}
                  {usesFallbackMode ? ' • Basic audio mode' : ' • High quality audio'}
                </span>
              </div>
            ) : (
              <span>Ready to start audio call</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallSection;
