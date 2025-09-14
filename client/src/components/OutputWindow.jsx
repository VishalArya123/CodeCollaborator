import { useEffect, useRef, useState } from 'react';
import { FaPlay, FaRefresh, FaExpand, FaCompress, FaCode, FaTerminal, FaEye } from 'react-icons/fa';
import ConsoleOutput from './ConsoleOutput';

const OutputWindow = ({ html, css, js }) => {
  const iframeRef = useRef(null);
  const consoleRef = useRef(null);
  const [height, setHeight] = useState(350);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState('preview');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoExecute, setAutoExecute] = useState(true);
  const [executionCount, setExecutionCount] = useState(0);
  const startDragY = useRef(0);
  const startHeight = useRef(height);
  
  const tabs = [
    { id: 'preview', label: 'Preview', icon: FaEye },
    { id: 'console', label: 'Console', icon: FaTerminal },
  ];

  // Handle resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging && !isFullscreen) {
        const deltaY = e.clientY - startDragY.current;
        const newHeight = Math.max(200, Math.min(800, startHeight.current - deltaY));
        setHeight(newHeight);
      }
    };
    
    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isFullscreen]);
  
  const handleMouseDown = (e) => {
    if (isFullscreen) return;
    setIsDragging(true);
    startDragY.current = e.clientY;
    startHeight.current = height;
    e.preventDefault();
  };

  const handleRefresh = () => {
    if (activeTab === 'preview') {
      updateIframeContent();
    } else if (activeTab === 'console') {
      executeJavaScript();
    }
  };

  const executeJavaScript = () => {
    if (consoleRef.current) {
      consoleRef.current.executeCode(js, html, css);
      setExecutionCount(prev => prev + 1);
    }
  };

  const updateIframeContent = () => {
    if (!iframeRef.current) return;
    
    const iframe = iframeRef.current;
    const doc = iframe.contentDocument;
    
    if (doc) {
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Preview</title>
            <style>
              body {
                margin: 0;
                padding: 16px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              }
              ${css}
            </style>
          </head>
          <body>
            ${html}
            <script>
              try {
                ${js}
              } catch (error) {
                console.error('JavaScript Error:', error);
                document.body.innerHTML += '<div style="background: #fee; color: #c33; padding: 16px; margin: 16px 0; border-radius: 4px; font-family: monospace; font-size: 14px; white-space: pre-wrap;">JavaScript Error: ' + error.message + '</div>';
              }
            </script>
          </body>
        </html>
      `);
      doc.close();
    }
  };
  
  // Auto-execute when code changes
  useEffect(() => {
    if (autoExecute) {
      const debounceTimer = setTimeout(() => {
        if (activeTab === 'preview') {
          updateIframeContent();
        }
      }, 500);
      
      return () => clearTimeout(debounceTimer);
    }
  }, [html, css, js, autoExecute, activeTab]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const clearConsole = () => {
    if (consoleRef.current) {
      consoleRef.current.clearConsole();
    }
  };

  return (
    <>
      {/* FIXED: Main Output Window - Always visible with proper scrolling */}
      <div 
        className={`bg-white dark:bg-slate-900 border-t border-slate-300 dark:border-slate-700 flex flex-col shadow-lg transition-all duration-300 ${
          isFullscreen ? 'fixed inset-0 z-50' : ''
        }`}
        style={{ height: isFullscreen ? '100vh' : `${height}px` }}
      >
        {/* Resize Handle - Only show when not fullscreen */}
        {!isFullscreen && (
          <div 
            className="h-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 cursor-row-resize flex items-center justify-center transition-colors group"
            onMouseDown={handleMouseDown}
          >
            <div className="w-12 h-1 bg-slate-400 dark:bg-slate-500 rounded-full group-hover:bg-slate-600 dark:group-hover:bg-slate-300 transition-colors"></div>
          </div>
        )}
        
        {/* Header with Tabs and Controls */}
        <div className="bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between px-4 py-2">
            {/* Tabs */}
            <div className="flex items-center space-x-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {tab.id === 'console' && executionCount > 0 && (
                      <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                        {executionCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Controls */}
            <div className="flex items-center space-x-2">
              {/* Auto Execute Toggle */}
              <label className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={autoExecute}
                  onChange={(e) => setAutoExecute(e.target.checked)}
                  className="w-3 h-3 text-blue-500 rounded focus:ring-2 focus:ring-blue-200"
                />
                <span>Auto</span>
              </label>

              {/* Execute/Refresh Button */}
              <button 
                onClick={activeTab === 'console' ? executeJavaScript : handleRefresh}
                className="flex items-center space-x-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-xs font-medium transition-colors"
                title={activeTab === 'console' ? 'Execute JavaScript' : 'Refresh Preview'}
              >
                <FaPlay className="w-3 h-3" />
                <span>{activeTab === 'console' ? 'Run' : 'Refresh'}</span>
              </button>

              {/* Clear Console (only show when console tab is active) */}
              {activeTab === 'console' && (
                <button
                  onClick={clearConsole}
                  className="px-3 py-1.5 bg-slate-500 hover:bg-slate-600 text-white rounded-md text-xs font-medium transition-colors"
                  title="Clear Console"
                >
                  Clear
                </button>
              )}

              {/* Fullscreen Toggle */}
              <button 
                onClick={toggleFullscreen}
                className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                {isFullscreen ? (
                  <FaCompress className="w-4 h-4" />
                ) : (
                  <FaExpand className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* FIXED: Content Area - Proper scrolling and overflow handling */}
        <div className="flex-1 overflow-hidden min-h-0">
          {activeTab === 'preview' ? (
            <div className="h-full relative">
              <iframe
                ref={iframeRef}
                title="Code Preview"
                className="w-full h-full border-none bg-white"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              />
              
              {/* Loading Overlay */}
              {!html && !css && !js && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-800">
                  <div className="text-center text-slate-500 dark:text-slate-400">
                    <FaCode className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-lg font-medium mb-1">Start Coding</p>
                    <p className="text-sm">Your preview will appear here</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full">
              <ConsoleOutput ref={consoleRef} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-4 py-2 flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center space-x-4">
              <span>
                {activeTab === 'preview' 
                  ? `Preview ${autoExecute ? '(Auto-updating)' : '(Manual refresh)'}` 
                  : `Console ${executionCount > 0 ? `(${executionCount} executions)` : ''}`
                }
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              {activeTab === 'preview' && (
                <>
                  <span>HTML: {html.length} chars</span>
                  <span>•</span>
                  <span>CSS: {css.length} chars</span>
                  <span>•</span>
                  <span>JS: {js.length} chars</span>
                </>
              )}
              {isFullscreen && (
                <span className="text-blue-500">• Fullscreen Mode</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FIXED: Floating Output Button - Shows when output window might be hidden */}
      {!isFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="fixed bottom-4 right-20 z-30 p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-all duration-200 hover:scale-110"
          title="Toggle Output Fullscreen"
        >
          <FaExpand className="w-4 h-4" />
        </button>
      )}
    </>
  );
};

export default OutputWindow;
