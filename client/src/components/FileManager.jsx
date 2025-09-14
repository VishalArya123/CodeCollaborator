import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { 
  FaUpload,
  FaDownload,
  FaTrash,
  FaFile,
  FaImage,
  FaVideo,
  FaMusic,
  FaCode,
  FaArchive,
  FaFileAlt,
  FaSearch,
  FaFilter,
  FaSort,
  FaEye,
  FaShare,
  FaCopy,
  FaFolderOpen,
  FaCloudUploadAlt,
  FaTimes,
  FaCheck,
  FaSpinner
} from 'react-icons/fa';

// Enhanced file type detection with better icons
const getFileTypeInfo = (fileName) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  const typeMap = {
    // Images
    jpg: { icon: FaImage, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/20', category: 'image', label: 'Image' },
    jpeg: { icon: FaImage, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/20', category: 'image', label: 'Image' },
    png: { icon: FaImage, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/20', category: 'image', label: 'Image' },
    gif: { icon: FaImage, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/20', category: 'image', label: 'GIF' },
    svg: { icon: FaImage, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/20', category: 'image', label: 'SVG' },
    webp: { icon: FaImage, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/20', category: 'image', label: 'WebP' },
    
    // Videos
    mp4: { icon: FaVideo, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/20', category: 'video', label: 'Video' },
    avi: { icon: FaVideo, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/20', category: 'video', label: 'Video' },
    mov: { icon: FaVideo, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/20', category: 'video', label: 'Video' },
    wmv: { icon: FaVideo, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/20', category: 'video', label: 'Video' },
    webm: { icon: FaVideo, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/20', category: 'video', label: 'Video' },
    
    // Audio
    mp3: { icon: FaMusic, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/20', category: 'audio', label: 'Audio' },
    wav: { icon: FaMusic, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/20', category: 'audio', label: 'Audio' },
    flac: { icon: FaMusic, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/20', category: 'audio', label: 'Audio' },
    aac: { icon: FaMusic, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/20', category: 'audio', label: 'Audio' },
    
    // Documents
    pdf: { icon: FaFileAlt, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/20', category: 'document', label: 'PDF' },
    doc: { icon: FaFileAlt, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/20', category: 'document', label: 'Word' },
    docx: { icon: FaFileAlt, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/20', category: 'document', label: 'Word' },
    txt: { icon: FaFileAlt, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800', category: 'document', label: 'Text' },
    rtf: { icon: FaFileAlt, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800', category: 'document', label: 'RTF' },
    
    // Code files
    js: { icon: FaCode, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/20', category: 'code', label: 'JavaScript' },
    jsx: { icon: FaCode, color: 'text-cyan-500', bg: 'bg-cyan-100 dark:bg-cyan-900/20', category: 'code', label: 'React' },
    ts: { icon: FaCode, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/20', category: 'code', label: 'TypeScript' },
    tsx: { icon: FaCode, color: 'text-cyan-500', bg: 'bg-cyan-100 dark:bg-cyan-900/20', category: 'code', label: 'React TS' },
    html: { icon: FaCode, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/20', category: 'code', label: 'HTML' },
    css: { icon: FaCode, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/20', category: 'code', label: 'CSS' },
    py: { icon: FaCode, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/20', category: 'code', label: 'Python' },
    java: { icon: FaCode, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/20', category: 'code', label: 'Java' },
    cpp: { icon: FaCode, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/20', category: 'code', label: 'C++' },
    c: { icon: FaCode, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/20', category: 'code', label: 'C' },
    php: { icon: FaCode, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/20', category: 'code', label: 'PHP' },
    rb: { icon: FaCode, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/20', category: 'code', label: 'Ruby' },
    
    // Data files
    json: { icon: FaCode, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/20', category: 'data', label: 'JSON' },
    xml: { icon: FaCode, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/20', category: 'data', label: 'XML' },
    yaml: { icon: FaCode, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/20', category: 'data', label: 'YAML' },
    yml: { icon: FaCode, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/20', category: 'data', label: 'YAML' },
    
    // Archives
    zip: { icon: FaArchive, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/20', category: 'archive', label: 'ZIP' },
    rar: { icon: FaArchive, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/20', category: 'archive', label: 'RAR' },
    tar: { icon: FaArchive, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/20', category: 'archive', label: 'TAR' },
    gz: { icon: FaArchive, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/20', category: 'archive', label: 'GZIP' },
    '7z': { icon: FaArchive, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/20', category: 'archive', label: '7ZIP' },
  };
  
  return typeMap[extension] || { 
    icon: FaFile, 
    color: 'text-slate-500', 
    bg: 'bg-slate-100 dark:bg-slate-800', 
    category: 'other', 
    label: 'File' 
  };
};

// Format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Format upload date
const formatUploadDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now - date) / (1000 * 60 * 60);
  
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  return date.toLocaleDateString();
};

const FileManager = ({ roomId, username }) => {
  const { socket, connected } = useSocket();
  const [files, setFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [showPreview, setShowPreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!socket || !connected) return;

    // Listen for file updates
    socket.on('files-updated', (updatedFiles) => {
      setFiles(updatedFiles);
      setUploadProgress({});
    });

    socket.on('upload-error', ({ message }) => {
      console.error('Upload error:', message);
      setIsUploading(false);
      setUploadProgress({});
    });

    // Request current files when component mounts
    socket.emit('get-room-files', { roomId });

    return () => {
      socket.off('files-updated');
      socket.off('upload-error');
    };
  }, [socket, connected, roomId]);

  // Process files (filter, search, sort)
  const processedFiles = files
    .filter(file => {
      // Search filter
      if (searchQuery && !file.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Category filter
      if (filterBy !== 'all') {
        const fileType = getFileTypeInfo(file.name);
        return fileType.category === filterBy;
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return b.size - a.size;
        case 'type':
          const aType = getFileTypeInfo(a.name).label;
          const bType = getFileTypeInfo(b.name).label;
          return aType.localeCompare(bType);
        case 'date':
        default:
          return new Date(b.uploadedAt) - new Date(a.uploadedAt);
      }
    });

  // Handle file upload
  const handleFileUpload = async (uploadFiles) => {
    if (!uploadFiles || uploadFiles.length === 0 || !socket || !connected) return;

    setIsUploading(true);
    const maxFileSize = 50e6; // 50MB
    const maxFiles = 10;

    if (uploadFiles.length > maxFiles) {
      alert(`Too many files selected. Maximum ${maxFiles} files allowed.`);
      setIsUploading(false);
      return;
    }

    const validFiles = [];
    const progressMap = {};

    for (const file of Array.from(uploadFiles)) {
      if (file.size > maxFileSize) {
        alert(`File "${file.name}" is too large. Maximum size is 50MB.`);
        continue;
      }

      progressMap[file.name] = 0;
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      setIsUploading(false);
      return;
    }

    setUploadProgress(progressMap);

    try {
      const filePromises = validFiles.map((file, index) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          
          reader.onload = (e) => {
            const fileData = {
              id: `${Date.now()}-${index}-${Math.random()}`,
              name: file.name,
              size: file.size,
              type: file.type,
              data: e.target.result,
              uploadedBy: username,
              uploadedAt: new Date().toISOString(),
              uploaderId: socket.id
            };
            
            setUploadProgress(prev => ({
              ...prev,
              [file.name]: 100
            }));
            
            resolve(fileData);
          };
          
          reader.onerror = () => {
            reject(new Error(`Failed to read file ${file.name}`));
          };
          
          reader.onprogress = (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              setUploadProgress(prev => ({
                ...prev,
                [file.name]: progress
              }));
            }
          };
          
          reader.readAsDataURL(file);
        });
      });

      const fileData = await Promise.all(filePromises);
      socket.emit('upload-files', { roomId, files: fileData });
      
    } catch (error) {
      console.error('Error uploading files:', error);
      alert(`Error uploading files: ${error.message}`);
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

  // Delete file with confirmation
  const deleteFile = (fileId, fileName) => {
    if (window.confirm(`Are you sure you want to delete "${fileName}"?`) && socket && connected) {
      socket.emit('delete-file', { roomId, fileId });
    }
  };

  // Bulk actions
  const downloadSelectedFiles = async () => {
    if (selectedFiles.size === 0) return;
    
    if (selectedFiles.size === 1) {
      const fileId = Array.from(selectedFiles)[0];
      const file = files.find(f => f.id === fileId);
      if (file) downloadFile(file);
      return;
    }

    // Download multiple files as ZIP
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (const fileId of selectedFiles) {
        const file = files.find(f => f.id === fileId);
        if (file) {
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
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(content);
      link.download = `selected-files-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Error creating zip file:', error);
      alert('Error downloading files. Please try downloading individually.');
    }
  };

  const deleteSelectedFiles = () => {
    if (selectedFiles.size === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedFiles.size} selected file(s)?`)) {
      selectedFiles.forEach(fileId => {
        socket.emit('delete-file', { roomId, fileId });
      });
      setSelectedFiles(new Set());
    }
  };

  // Toggle file selection
  const toggleFileSelection = (fileId) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFiles(newSelection);
  };

  // Select all files
  const selectAllFiles = () => {
    if (selectedFiles.size === processedFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(processedFiles.map(f => f.id)));
    }
  };

  // File categories for filtering
  const categories = [
    { id: 'all', label: 'All Files', icon: FaFile },
    { id: 'image', label: 'Images', icon: FaImage },
    { id: 'video', label: 'Videos', icon: FaVideo },
    { id: 'audio', label: 'Audio', icon: FaMusic },
    { id: 'document', label: 'Documents', icon: FaFileAlt },
    { id: 'code', label: 'Code', icon: FaCode },
    { id: 'archive', label: 'Archives', icon: FaArchive },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 border-b border-slate-200 dark:border-slate-600">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <FaFolderOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              File Manager
            </h3>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">
              {files.length} files • {formatFileSize(files.reduce((sum, f) => sum + f.size, 0))}
            </span>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || !connected}
              className="flex items-center space-x-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-md text-sm transition-colors"
            >
              {isUploading ? <FaSpinner className="w-3 h-3 animate-spin" /> : <FaUpload className="w-3 h-3" />}
              <span>Upload</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value)}
                className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                <option value="date">Sort by Date</option>
                <option value="name">Sort by Name</option>
                <option value="size">Sort by Size</option>
                <option value="type">Sort by Type</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              {selectedFiles.size > 0 && (
                <>
                  <button
                    onClick={downloadSelectedFiles}
                    className="flex items-center space-x-1 px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs"
                  >
                    <FaDownload className="w-3 h-3" />
                    <span>Download ({selectedFiles.size})</span>
                  </button>
                  
                  <button
                    onClick={deleteSelectedFiles}
                    className="flex items-center space-x-1 px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs"
                  >
                    <FaTrash className="w-3 h-3" />
                    <span>Delete ({selectedFiles.size})</span>
                  </button>
                </>
              )}
              
              <button
                onClick={selectAllFiles}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                {selectedFiles.size === processedFiles.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        className="hidden"
        accept="*/*"
      />

      {/* Upload Progress */}
      {isUploading && Object.keys(uploadProgress).length > 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <div className="space-y-2">
            {Object.entries(uploadProgress).map(([fileName, progress]) => (
              <div key={fileName} className="flex items-center space-x-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                      {fileName}
                    </span>
                    <span className="text-blue-600 dark:text-blue-400">
                      {progress}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drag and Drop Area / File List */}
      <div 
        className={`flex-1 overflow-hidden ${
          isDragOver ? 'bg-blue-50 dark:bg-blue-900/20' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {processedFiles.length === 0 ? (
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 mx-auto">
                <FaCloudUploadAlt className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
                {searchQuery ? 'No matching files' : 'No files uploaded yet'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-sm">
                {searchQuery 
                  ? `No files match "${searchQuery}"`
                  : 'Drag and drop files here or click the upload button to get started'
                }
              </p>
              {!searchQuery && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  Choose Files
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-4">
            <div className="space-y-2">
              {processedFiles.map((file) => {
                const fileType = getFileTypeInfo(file.name);
                const FileIcon = fileType.icon;
                const isSelected = selectedFiles.has(file.id);
                const isOwner = file.uploaderId === socket?.id;
                
                return (
                  <div
                    key={file.id}
                    className={`flex items-center p-3 rounded-lg border-2 transition-all duration-200 hover:shadow-md cursor-pointer ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                    onClick={() => toggleFileSelection(file.id)}
                  >
                    {/* Selection Checkbox */}
                    <div className="mr-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected 
                          ? 'bg-blue-500 border-blue-500' 
                          : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {isSelected && <FaCheck className="w-3 h-3 text-white" />}
                      </div>
                    </div>

                    {/* File Icon */}
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center mr-4 ${fileType.bg}`}>
                      <FileIcon className={`w-6 h-6 ${fileType.color}`} />
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {file.name}
                        </h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${fileType.bg} ${fileType.color}`}>
                          {fileType.label}
                        </span>
                        {isOwner && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full">
                            Owner
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-slate-500 dark:text-slate-400">
                        <span>{formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span>by {file.uploadedBy}</span>
                        <span>•</span>
                        <span>{formatUploadDate(file.uploadedAt)}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2 ml-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => downloadFile(file)}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Download file"
                      >
                        <FaDownload className="w-4 h-4" />
                      </button>
                      
                      {(isOwner || file.uploadedBy === username) && (
                        <button
                          onClick={() => deleteFile(file.id, file.name)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete file"
                          disabled={!connected}
                        >
                          <FaTrash className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-600">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div>
            {processedFiles.length} of {files.length} files 
            {selectedFiles.size > 0 && ` • ${selectedFiles.size} selected`}
          </div>
          
          <div className="flex items-center space-x-2">
            <span>Total: {formatFileSize(files.reduce((sum, f) => sum + f.size, 0))}</span>
            {!connected && (
              <span className="text-red-500">• Offline</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileManager;
