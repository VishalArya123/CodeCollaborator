import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { FaTrash, FaCopy, FaDownload, FaTerminal } from 'react-icons/fa';

const ConsoleOutput = forwardRef((props, ref) => {
  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const consoleEndRef = useRef(null);

  useImperativeHandle(ref, () => ({
    executeCode: (code, html = '', css = '') => executeJavaScript(code, html, css),
    clearConsole: () => setLogs([]),
  }));

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const logTypes = {
    log: { color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-slate-800', icon: '📝' },
    info: { color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'ℹ️' },
    warn: { color: 'text-yellow-700 dark:text-yellow-300', bg: 'bg-yellow-50 dark:bg-yellow-900/20', icon: '⚠️' },
    error: { color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-900/20', icon: '❌' },
    success: { color: 'text-green-700 dark:text-green-300', bg: 'bg-green-50 dark:bg-green-900/20', icon: '✅' },
    system: { color: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-50 dark:bg-indigo-900/20', icon: '🔧' }
  };

  const addLog = (message, type = 'log', data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      id: Date.now() + Math.random(),
      message,
      type,
      timestamp,
      data,
    };
    setLogs(prev => [...prev, logEntry]);
  };

  const formatLogMessage = (message, data) => {
    if (typeof message === 'object') {
      try {
        return JSON.stringify(message, null, 2);
      } catch (error) {
        return String(message);
      }
    }
    
    if (data && typeof data === 'object') {
      try {
        return `${message} ${JSON.stringify(data, null, 2)}`;
      } catch (error) {
        return `${message} [object]`;
      }
    }
    
    return String(message);
  };

  // FIXED: Simplified JavaScript execution without cross-origin issues
  const executeJavaScript = async (code, html = '', css = '') => {
    if (!code.trim()) {
      addLog('No JavaScript code to execute', 'warn');
      return;
    }

    setIsRunning(true);
    addLog('Executing JavaScript code...', 'system');

    try {
      // Create a safe execution context using Function constructor
      const originalConsole = {
        log: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error
      };

      // Override console methods to capture output
      const capturedLogs = [];
      
      console.log = (...args) => {
        originalConsole.log(...args);
        const message = args.map(arg => {
          if (typeof arg === 'object' && arg !== null) {
            try {
              return JSON.stringify(arg, null, 2);
            } catch (e) {
              return String(arg);
            }
          }
          return String(arg);
        }).join(' ');
        addLog(message, 'log');
      };

      console.info = (...args) => {
        originalConsole.info(...args);
        const message = args.map(arg => String(arg)).join(' ');
        addLog(message, 'info');
      };

      console.warn = (...args) => {
        originalConsole.warn(...args);
        const message = args.map(arg => String(arg)).join(' ');
        addLog(message, 'warn');
      };

      console.error = (...args) => {
        originalConsole.error(...args);
        const message = args.map(arg => String(arg)).join(' ');
        addLog(message, 'error');
      };

      // Create a safe context for code execution
      const executeInContext = new Function(`
        try {
          ${code}
          return { success: true };
        } catch (error) {
          console.error('Execution Error: ' + error.message);
          return { success: false, error: error.message };
        }
      `);

      const result = executeInContext();
      
      if (result.success) {
        addLog('Code executed successfully', 'success');
      } else {
        addLog(`Execution failed: ${result.error}`, 'error');
      }

      // Restore original console methods
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;

    } catch (error) {
      addLog(`Execution error: ${error.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const clearConsole = () => {
    setLogs([]);
    addLog('Console cleared', 'system');
  };

  const copyLogs = () => {
    const logText = logs.map(log => 
      `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}`
    ).join('\n');
    
    navigator.clipboard.writeText(logText).then(() => {
      addLog('Logs copied to clipboard', 'success');
    }).catch(() => {
      addLog('Failed to copy logs', 'error');
    });
  };

  const downloadLogs = () => {
    const logText = logs.map(log => 
      `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      <div className="flex items-center justify-between p-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center space-x-2">
          <FaTerminal className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-semibold text-slate-200">Console</h3>
          {isRunning && (
            <div className="flex items-center space-x-2 text-xs text-blue-400">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <span>Running...</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={copyLogs}
            disabled={logs.length === 0}
            className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Copy logs"
          >
            <FaCopy className="w-3 h-3" />
          </button>
          <button
            onClick={downloadLogs}
            disabled={logs.length === 0}
            className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Download logs"
          >
            <FaDownload className="w-3 h-3" />
          </button>
          <button
            onClick={clearConsole}
            className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
            title="Clear console"
          >
            <FaTrash className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-sm">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <FaTerminal className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-center">
              Console output will appear here
              <br />
              <span className="text-xs">Run your JavaScript code to see results</span>
            </p>
          </div>
        ) : (
          logs.map((log) => {
            const logStyle = logTypes[log.type] || logTypes.log;
            return (
              <div
                key={log.id}
                className={`p-2 rounded border-l-4 ${logStyle.bg} border-l-current ${logStyle.color}`}
              >
                <div className="flex items-start space-x-2">
                  <span className="text-xs opacity-75 flex-shrink-0">
                    {logStyle.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                      {formatLogMessage(log.message, log.data)}
                    </pre>
                    <div className="text-xs opacity-50 mt-1">
                      {log.timestamp}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={consoleEndRef} />
      </div>

      <div className="p-2 bg-slate-800 border-t border-slate-700">
        <div className="text-xs text-slate-400 text-center">
          {logs.length} log{logs.length !== 1 ? 's' : ''}
          {isRunning && (
            <span className="ml-2 text-blue-400">• Code executing...</span>
          )}
        </div>
      </div>
    </div>
  );
});

ConsoleOutput.displayName = 'ConsoleOutput';
export default ConsoleOutput;
