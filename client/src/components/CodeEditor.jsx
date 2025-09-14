import { useEffect, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { html as htmlLang } from '@codemirror/lang-html';
import { css as cssLang } from '@codemirror/lang-css';
import { javascript as jsLang } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { EditorView } from '@codemirror/view';
import { 
  FaExpand, 
  FaCompress, 
  FaCopy, 
  FaDownload, 
  FaEye, 
  FaEyeSlash,
  FaPalette,
  FaTextHeight,
  FaCode,
  FaUsers,
  FaMousePointer
} from 'react-icons/fa';

const CodeEditor = ({ code, language, onChange, roomId, username, socket }) => {
  const editorRef = useRef(null);
  const [cursors, setCursors] = useState({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [fontSize, setFontSize] = useState(14);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [showCursors, setShowCursors] = useState(true);
  const [editorView, setEditorView] = useState(null);
  const [collaborators, setCollaborators] = useState([]);
  const debounceTimeout = useRef(null);
  
  const languages = {
    html: { 
      extension: htmlLang(), 
      name: 'HTML', 
      icon: '🌐',
      color: 'text-orange-500'
    },
    css: { 
      extension: cssLang(), 
      name: 'CSS', 
      icon: '🎨',
      color: 'text-blue-500'
    },
    js: { 
      extension: jsLang(), 
      name: 'JavaScript', 
      icon: '⚡',
      color: 'text-yellow-500'
    }
  };

  const themes = {
    light: { theme: vscodeLight, name: 'Light', icon: '☀️' },
    dark: { theme: vscodeDark, name: 'Dark', icon: '🌙' },
    onedark: { theme: oneDark, name: 'One Dark', icon: '🌃' }
  };

  const currentLang = languages[language] || languages.html;

  const handleCursorActivity = (viewUpdate) => {
    if (!socket || !showCursors) return;
    
    const { view } = viewUpdate;
    const selection = view.state.selection.main;
    const position = view.state.doc.lineAt(selection.head);
    
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    debounceTimeout.current = setTimeout(() => {
      socket.emit('cursor-position', {
        roomId,
        username,
        position: {
          language,
          line: position.number,
          ch: selection.head - position.from,
          offset: selection.head
        }
      });
    }, 100);
  };

  useEffect(() => {
    if (!socket || !showCursors) return;
    
    const handleCursorUpdate = ({ userId, username, position }) => {
      if (position.language !== language) return;
      
      setCursors((prev) => ({
        ...prev,
        [userId]: {
          username,
          position,
          color: stringToColor(username),
          lastUpdate: Date.now()
        }
      }));

      setCollaborators(prev => {
        const existing = prev.find(c => c.userId === userId);
        if (existing) {
          return prev.map(c => 
            c.userId === userId 
              ? { ...c, lastActive: Date.now(), language, position }
              : c
          );
        } else {
          return [...prev, {
            userId,
            username,
            language,
            position,
            color: stringToColor(username),
            lastActive: Date.now()
          }];
        }
      });

      setTimeout(() => {
        setCursors((prev) => {
          const cursor = prev[userId];
          if (cursor && Date.now() - cursor.lastUpdate > 9000) {
            const newCursors = { ...prev };
            delete newCursors[userId];
            return newCursors;
          }
          return prev;
        });
      }, 10000);
    };
    
    socket.on('cursor-update', handleCursorUpdate);
    
    return () => {
      socket.off('cursor-update', handleCursorUpdate);
    };
  }, [socket, language, showCursors]);

  useEffect(() => {
    if (!socket) return;

    const handleUserLeft = ({ userId }) => {
      setCursors((prev) => {
        const newCursors = { ...prev };
        delete newCursors[userId];
        return newCursors;
      });

      setCollaborators(prev => prev.filter(c => c.userId !== userId));
    };

    socket.on('user-left', handleUserLeft);

    return () => {
      socket.off('user-left', handleUserLeft);
    };
  }, [socket]);

  const handleEditorMount = (view) => {
    setEditorView(view);
  };
  
  const renderCursors = () => {
    if (!editorView || !showCursors) return null;
    
    const cursorElements = Object.entries(cursors).map(([userId, { username, position, color }]) => {
      if (position.language !== language) return null;
      
      try {
        const pos = Math.min(position.offset || 0, editorView.state.doc.length);
        const coords = editorView.coordsAtPos(pos);
        
        if (!coords) return null;
        
        return (
          <div key={userId}>
            <div 
              className="absolute w-0.5 z-20 pointer-events-none animate-pulse"
              style={{
                left: `${coords.left}px`,
                top: `${coords.top}px`,
                height: `${coords.bottom - coords.top}px`,
                backgroundColor: color,
                transform: 'translateX(-1px)'
              }}
            />
            
            <div 
              className="absolute px-2 py-1 text-xs text-white rounded-md text-nowrap z-30 pointer-events-none shadow-lg"
              style={{
                left: `${coords.left}px`,
                top: `${coords.top - 28}px`,
                backgroundColor: color,
                fontSize: '11px',
                maxWidth: '120px',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {username}
            </div>
          </div>
        );
      } catch (error) {
        console.warn('Error rendering cursor:', error);
        return null;
      }
    });
    
    return cursorElements;
  };
  
  const stringToColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 55%)`;
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const downloadCode = () => {
    const extensions = { html: 'html', css: 'css', js: 'js' };
    const extension = extensions[language] || 'txt';
    
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  const extensions = [
    currentLang.extension,
    EditorView.theme({
      '&': {
        fontSize: `${fontSize}px`,
      },
      '.cm-editor': {
        fontSize: `${fontSize}px`,
      },
      '.cm-content': {
        padding: '16px',
        minHeight: '400px',
      },
      '.cm-focused': {
        outline: 'none',
      },
      '.cm-line': {
        padding: '0 4px',
      }
    })
  ];

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-slate-900 ${
      isFullscreen ? 'fixed inset-0 z-50' : ''
    }`}>
      {/* Editor Header */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        {/* Language Info */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{currentLang.icon}</span>
            <div>
              <h3 className={`font-semibold ${currentLang.color}`}>
                {currentLang.name}
              </h3>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {code.length} characters
              </div>
            </div>
          </div>

          {/* Collaborators */}
          {collaborators.length > 0 && (
            <div className="flex items-center space-x-2 ml-4">
              <FaUsers className="w-4 h-4 text-slate-400" />
              <div className="flex -space-x-2">
                {collaborators
                  .filter(c => c.language === language)
                  .slice(0, 3)
                  .map((collaborator) => (
                    <div
                      key={collaborator.userId}
                      className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center text-xs font-bold text-white shadow-sm"
                      style={{ backgroundColor: collaborator.color }}
                      title={`${collaborator.username} - editing ${collaborator.language}`}
                    >
                      {collaborator.username.charAt(0).toUpperCase()}
                    </div>
                  ))}
                {collaborators.filter(c => c.language === language).length > 3 && (
                  <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-800 bg-slate-400 flex items-center justify-center text-xs font-bold text-white">
                    +{collaborators.filter(c => c.language === language).length - 3}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Editor Controls */}
        <div className="flex items-center space-x-2">
          {/* Theme Selector */}
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300"
          >
            {Object.entries(themes).map(([key, { name, icon }]) => (
              <option key={key} value={key}>
                {icon} {name}
              </option>
            ))}
          </select>

          {/* Font Size */}
          <div className="flex items-center space-x-1">
            <FaTextHeight className="w-3 h-3 text-slate-400" />
            <select
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300"
            >
              {[12, 14, 16, 18, 20].map(size => (
                <option key={size} value={size}>{size}px</option>
              ))}
            </select>
          </div>

          {/* Toggle Controls */}
          <button
            onClick={() => setShowLineNumbers(!showLineNumbers)}
            className={`p-2 rounded transition-colors ${
              showLineNumbers
                ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            title="Toggle line numbers"
          >
            {showLineNumbers ? <FaEye className="w-4 h-4" /> : <FaEyeSlash className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setShowCursors(!showCursors)}
            className={`p-2 rounded transition-colors ${
              showCursors
                ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            title="Toggle collaborative cursors"
          >
            <FaMousePointer className="w-4 h-4" />
          </button>

          {/* Action Buttons */}
          <button
            onClick={copyCode}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title="Copy code"
          >
            <FaCopy className="w-4 h-4" />
          </button>

          <button
            onClick={downloadCode}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title="Download code"
          >
            <FaDownload className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <FaCompress className="w-4 h-4" /> : <FaExpand className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden relative">
        <CodeMirror
          ref={editorRef}
          value={code}
          height="100%"
          theme={themes[theme].theme}
          extensions={extensions}
          onChange={onChange}
          onUpdate={handleCursorActivity}
          onCreateEditor={handleEditorMount}
          basicSetup={{
            lineNumbers: showLineNumbers,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            searchKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true
          }}
        />
        
        {/* Collaborative Cursors */}
        <div className="absolute inset-0 pointer-events-none">
          {renderCursors()}
        </div>
      </div>

      {/* Footer Status */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center space-x-4">
            <span>
              {currentLang.name} • {code.split('\n').length} lines • {code.length} chars
            </span>
            {collaborators.filter(c => c.language === language).length > 0 && (
              <span className="flex items-center space-x-1">
                <FaUsers className="w-3 h-3" />
                <span>{collaborators.filter(c => c.language === language).length} editing</span>
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <span>Theme: {themes[theme].name}</span>
            <span>Font: {fontSize}px</span>
            {isFullscreen && <span className="text-indigo-500">Fullscreen</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
