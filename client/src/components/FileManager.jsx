import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext'; // Import SocketContext

// File type icons mapping
const getFileIcon = (fileName) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const iconMap = {
    // Images
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️',
    // Videos
    mp4: '🎬', avi: '🎬', mov: '🎬', wmv: '🎬', flv: '🎬', webm: '🎬',
    // Audio
    mp3: '🎵', wav: '🎵', flac: '🎵', aac: '🎵', ogg: '🎵',
    // Documents
    pdf: '📄', doc: '📄', docx: '📄', txt: '📄', rtf: '📄',
    xls: '📊', xlsx: '📊', csv: '📊',
    ppt: '📽️', pptx: '📽️',
    // Code files
    js: '💻', jsx: '💻', ts: '💻', tsx: '💻', html: '💻', css: '💻',
    py: '🐍', java: '☕', cpp: '🔧', c: '🔧', php: '🌐', rb: '💎',
    json: '📋', xml: '📋', yaml: '📋', yml: '📋',
    // Archives
    zip: '📦', rar: '📦', tar: '📦', gz: '📦', '7z': '📦',
    // Default
    default: '📁'
  };
  return iconMap[extension] || iconMap.default;
};

// Format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const FileManager = ({ roomId, username }) => {
  const { socket, connected } = useSocket(); // Use SocketContext
  const [files, setFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!socket || !connected) return;

    // Listen for file updates
    socket.on('files-updated', (updatedFiles) => {
      setFiles(updatedFiles);
    });

    // Request current files when component mounts
    socket.emit('get-room-files', { roomId });

    return () => {
      socket.off('files-updated');
    };
  }, [socket, connected, roomId]);

  // Handle file upload
  const handleFileUpload = async (uploadFiles) => {
    if (!uploadFiles || uploadFiles.length === 0 || !socket || !connected) return;

    setIsUploading(true);
    const filePromises = Array.from(uploadFiles).map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            id: `${Date.now()}-${Math.random()}`,
            name: file.name,
            size: file.size,
            type: file.type,
            data: e.target.result,
            uploadedBy: username,
            uploadedAt: new Date().toISOString()
          });
        };
        reader.readAsDataURL(file);
      });
    });

    try {
      const fileData = await Promise.all(filePromises);
      socket.emit('upload-files', { roomId, files: fileData });
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Error uploading files. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = e.dataTransfer.files;
    handleFileUpload(droppedFiles);
  };

  // Handle file input change
  const handleFileInputChange = (e) => {
    handleFileUpload(e.target.files);
    e.target.value = ''; // Reset input
  };

  // Download single file
  const downloadFile = (file) => {
    const link = document.createElement('a');
    link.href = file.data;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Delete file
  const deleteFile = (fileId) => {
    if (window.confirm('Are you sure you want to delete this file?') && socket && connected) {
      socket.emit('delete-file', { roomId, fileId });
    }
  };

  // Download all files as zip
  const downloadAllFiles = async () => {
    if (files.length === 0) {
      alert('No files to download');
      return;
    }

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      files.forEach(file => {
        const dataURL = file.data;
        const byteString = atob(dataURL.split(',')[1]);
        const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });
        zip.file(file.name, blob);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(content);
      link.download = `room-${roomId}-files.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Error creating zip file:', error);
      alert('Error downloading files. Please try downloading individually.');
    }
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">File Manager</h3>
        <div className="flex items-center gap-1">
          {files.length > 0 && (
            <button
              onClick={downloadAllFiles}
              className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Download all files as ZIP"
            >
              📦
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
            title="Upload files"
            disabled={isUploading || !connected}
          >
            {isUploading ? '⏳' : '📤'}
          </button>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        className="hidden"
        accept="*/*"
      />

      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center text-sm transition-colors ${
          isDragOver
            ? 'border-blue-400 bg-blue-50 text-blue-600'
            : 'border-gray-300 text-gray-500 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {isUploading ? (
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Uploading...</span>
          </div>
        ) : (
          <div>
            <div className="text-2xl mb-1">📁</div>
            <div>Drop files here or click to upload</div>
            <div className="text-xs text-gray-400 mt-1">
              Images, videos, documents, code files, etc.
            </div>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="mt-3 max-h-48 overflow-y-auto">
          <div className="space-y-1">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded text-xs hover:bg-gray-50"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-base">{getFileIcon(file.name)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 truncate" title={file.name}>
                      {file.name}
                    </div>
                    <div className="text-gray-500 flex items-center gap-2">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span title={`Uploaded by ${file.uploadedBy} at ${new Date(file.uploadedAt).toLocaleString()}`}>
                        {file.uploadedBy}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => downloadFile(file)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Download file"
                  >
                    ⬇️
                  </button>
                  <button
                    onClick={() => deleteFile(file.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete file"
                    disabled={!connected}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {files.length === 0 && !isUploading && (
        <div className="text-center text-xs text-gray-400 mt-3 py-2">
          No files uploaded yet
        </div>
      )}
    </div>
  );
};

export default FileManager;