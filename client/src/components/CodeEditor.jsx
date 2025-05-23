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
    const { line, ch } = view.state.selection.main.head;
    
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
          line,
          ch
        }
      });
    }, 100); // 100ms debounce
  };

  // Handle cursor updates from other users
  useEffect(() => {
    if (!socket) return;
    
    socket.on('cursor-update', ({ userId, username, position }) => {
      if (position.language !== language) return;
      
      setCursors((prev) => ({
        ...prev,
        [userId]: {
          username,
          position
        }
      }));
    });
    
    return () => {
      socket.off('cursor-update');
    };
  }, [socket, language]);
  
  // Render other users' cursors
  const renderCursors = () => {
    if (!editorRef.current) return null;
    
    const cursorElements = Object.entries(cursors).map(([userId, { username, position }]) => {
      if (position.language !== language) return null;
      
      // Generate a unique color based on username
      const color = stringToColor(username);
      
      // Get position in the editor
      const coordsAtPos = editorRef.current.coordsAtPos(position.line, position.ch);
      
      if (!coordsAtPos) return null;
      
      return (
        <div key={userId}>
          <div 
            className="user-cursor"
            style={{
              left: `${coordsAtPos.left}px`,
              top: `${coordsAtPos.top}px`,
              height: `${coordsAtPos.height}px`,
              backgroundColor: color
            }}
          />
          <div 
            className="cursor-label"
            style={{
              left: `${coordsAtPos.left}px`,
              top: `${coordsAtPos.top - 20}px`,
              backgroundColor: color
            }}
          >
            {username}
          </div>
        </div>
      );
    });
    
    return cursorElements;
  };
  
  // Helper function to convert string to color
  const stringToColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 0xFF;
      color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
  };

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
      {renderCursors()}
    </div>
  );
};

export default CodeEditor;