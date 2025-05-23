import { useEffect, useRef, useState } from 'react';

const OutputWindow = ({ html, css, js }) => {
  const iframeRef = useRef(null);
  const [height, setHeight] = useState(300);
  const [isDragging, setIsDragging] = useState(false);
  const startDragY = useRef(0);
  const startHeight = useRef(height);
  
  // Handle resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const deltaY = e.clientY - startDragY.current;
        const newHeight = Math.max(150, startHeight.current - deltaY);
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
  }, [isDragging]);
  
  // Handle drag start
  const handleMouseDown = (e) => {
    setIsDragging(true);
    startDragY.current = e.clientY;
    startHeight.current = height;
    e.preventDefault(); // Prevent text selection during drag
  };
  
  // Update iframe content when code changes
  useEffect(() => {
    if (!iframeRef.current) return;
    
    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    
    // Construct the HTML content by combining HTML, CSS, and JS
    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>${css}</style>
        </head>
        <body>
          ${html}
          <script>${js}</script>
        </body>
      </html>
    `;
    
    // Write to the iframe
    doc.open();
    doc.write(content);
    doc.close();
  }, [html, css, js]);
  
  return (
    <div 
      className="bg-white border-t border-gray-300 flex flex-col"
      style={{ height: `${height}px` }}
    >
      <div 
        className="h-2 bg-gray-200 hover:bg-gray-300 cursor-row-resize flex items-center justify-center"
        onMouseDown={handleMouseDown}
      >
        <div className="w-20 h-1 bg-gray-400 rounded-full"></div>
      </div>
      
      <div className="p-2 bg-gray-100 border-b border-gray-300 flex justify-between items-center">
        <h3 className="text-sm font-medium">Output Preview</h3>
        <button 
          onClick={() => {
            if (iframeRef.current) {
              const iframe = iframeRef.current;
              iframe.contentWindow.location.reload();
            }
          }}
          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
        >
          Refresh
        </button>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          title="Output"
          className="w-full h-full border-none"
          sandbox="allow-scripts"
        />
      </div>
    </div>
  );
};

export default OutputWindow;