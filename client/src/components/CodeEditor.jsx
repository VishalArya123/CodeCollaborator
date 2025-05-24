import { useEffect, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { html as htmlLang } from '@codemirror/lang-html';
import { css as cssLang } from '@codemirror/lang-css';
import { javascript as jsLang } from '@codemirror/lang-javascript';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';

const CodeEditor = ({ code, language, onChange, roomId, username, socket }) => {
  const editorRef = useRef(null);
  const [cursors, setCursors] = useState({});
  const debounceTimeout = useRef(null);
  const [editorView, setEditorView] = useState(null);
  
  // Language extensions based on active tab
  const getLanguageExtension = () => {
    switch (language) {
      case 'html':
        return htmlLang();
      case 'css':
        return cssLang();
      case 'js':
        return jsLang();
      default:
        return htmlLang();
    }
  };

  // Update cursor position in a debounced manner
  const handleCursorActivity = (viewUpdate) => {
    if (!socket) return;
    
    const { view } = viewUpdate;
    const selection = view.state.selection.main;
    const position = view.state.doc.lineAt(selection.head);
    
    // Clear any existing timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    // Set a new timeout
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
    }, 100); // 100ms debounce
  };

  // Handle cursor updates from other users
  useEffect(() => {
    if (!socket) return;
    
    const handleCursorUpdate = ({ userId, username, position }) => {
      if (position.language !== language) return;
      
      setCursors((prev) => ({
        ...prev,
        [userId]: {
          username,
          position
        }
      }));

      // Clean up cursor after 5 seconds of inactivity
      setTimeout(() => {
        setCursors((prev) => {
          const newCursors = { ...prev };
          delete newCursors[userId];
          return newCursors;
        });
      }, 5000);
    };
    
    socket.on('cursor-update', handleCursorUpdate);
    
    return () => {
      socket.off('cursor-update', handleCursorUpdate);
    };
  }, [socket, language]);

  // Clean up cursors when users leave
  useEffect(() => {
    if (!socket) return;

    const handleUserLeft = ({ userId }) => {
      setCursors((prev) => {
        const newCursors = { ...prev };
        delete newCursors[userId];
        return newCursors;
      });
    };

    socket.on('user-left', handleUserLeft);

    return () => {
      socket.off('user-left', handleUserLeft);
    };
  }, [socket]);

  // Store editor view reference
  const handleEditorMount = (view) => {
    setEditorView(view);
  };
  
  // Render other users' cursors
  const renderCursors = () => {
    if (!editorView) return null;
    
    const cursorElements = Object.entries(cursors).map(([userId, { username, position }]) => {
      if (position.language !== language) return null;
      
      try {
        // Generate a unique color based on username
        const color = stringToColor(username);
        
        // Get position in the editor using CodeMirror 6 API
        const pos = Math.min(position.offset || 0, editorView.state.doc.length);
        const coords = editorView.coordsAtPos(pos);
        
        if (!coords) return null;
        
        return (
          <div key={userId}>
            <div 
              className="absolute w-0.5 z-10 pointer-events-none"
              style={{
                left: `${coords.left}px`,
                top: `${coords.top}px`,
                height: `${coords.bottom - coords.top}px`,
                backgroundColor: color,
                transform: 'translateX(-1px)'
              }}
            />
            <div 
              className="absolute px-1 py-0.5 text-xs text-white rounded text-nowrap z-20 pointer-events-none"
              style={{
                left: `${coords.left}px`,
                top: `${coords.top - 20}px`,
                backgroundColor: color,
                fontSize: '10px'
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
  
  // Helper function to convert string to color
  const stringToColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generate a bright, distinct color
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  return (
    <div className="flex-1 overflow-hidden relative">
      <CodeMirror
        ref={editorRef}
        value={code}
        height="100%"
        theme={vscodeDark}
        extensions={[getLanguageExtension()]}
        onChange={onChange}
        onUpdate={handleCursorActivity}
        onCreateEditor={handleEditorMount}
        style={{ fontSize: '14px' }}
        basicSetup={{
          lineNumbers: true,
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
      <div className="absolute inset-0 pointer-events-none">
        {renderCursors()}
      </div>
    </div>
  );
};

export default CodeEditor;