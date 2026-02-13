import { useState, useEffect } from 'react';
import { Upload, Download, Trash2, FileText, Image, File, Filter, Search } from 'lucide-react';

export default function Attachments() {
  const [attachments, setAttachments] = useState([]);
  const [oils, setOils] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOilId, setFilterOilId] = useState('');
  const [filterFileType, setFilterFileType] = useState('');
  
  // Upload form
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedOilId, setSelectedOilId] = useState('GENERAL');
  const [notes, setNotes] = useState('');
  
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchAttachments();
    fetchOils();
  }, [filterOilId, filterFileType]);

  const fetchAttachments = async () => {
    try {
      setLoading(true);
      let url = '/api/attachments';
      const params = new URLSearchParams();
      
      if (filterOilId) params.append('oilId', filterOilId);
      if (filterFileType) params.append('fileType', filterFileType);
      
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await fetch(url);
      const data = await response.json();
      setAttachments(data);
    } catch (error) {
      console.error('Error fetching attachments:', error);
      alert('Error loading attachments');
    } finally {
      setLoading(false);
    }
  };

  const fetchOils = async () => {
    try {
      const response = await fetch('/api/products?category=OILS');
      const data = await response.json();
      setOils(data);
    } catch (error) {
      console.error('Error fetching oils:', error);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        alert('File size must be less than 50MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      alert('Please select a file');
      return;
    }

    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('associatedOilId', selectedOilId);
      
      if (selectedOilId !== 'GENERAL') {
        const selectedOil = oils.find(o => o.id === selectedOilId);
        formData.append('associatedOilName', selectedOil?.name || '');
      }
      
      formData.append('uploadedBy', currentUser.name || 'admin');
      formData.append('notes', notes);

      const response = await fetch('/api/attachments/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      alert('File uploaded successfully!');
      
      // Reset form
      setSelectedFile(null);
      setSelectedOilId('GENERAL');
      setNotes('');
      document.getElementById('file-input').value = '';
      
      // Refresh list
      fetchAttachments();
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id, fileName) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/attachments/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      alert('File deleted successfully!');
      fetchAttachments();
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Error deleting file');
    }
  };

  const handleDownload = (filePath, fileName) => {
    const link = document.createElement('a');
    link.href = `${filePath}`;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFileIcon = (fileType) => {
    if (fileType.includes('image')) {
      return <Image className="w-8 h-8 text-blue-500" />;
    } else if (fileType.includes('pdf')) {
      return <FileText className="w-8 h-8 text-red-500" />;
    } else if (fileType.includes('sheet') || fileType.includes('excel')) {
      return <File className="w-8 h-8 text-green-500" />;
    } else {
      return <File className="w-8 h-8 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredAttachments = attachments.filter(att => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        att.fileName.toLowerCase().includes(search) ||
        att.associatedOilName.toLowerCase().includes(search) ||
        (att.notes && att.notes.toLowerCase().includes(search))
      );
    }
    return true;
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tighter uppercase">ATTACHMENTS</h1>
        <p className="text-gray-600 mt-1">Document Library - Upload and manage files related to oils</p>
      </div>

      {/* Upload Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Upload New Document
        </h2>
        
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">File *</label>
              <input
                id="file-input"
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif,.csv"
                className="w-full border border-gray-300 rounded px-3 py-2"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Allowed: PDF, DOC, DOCX, XLS, XLSX, TXT, JPG, PNG, GIF, CSV (Max 50MB)
              </p>
              {selectedFile && (
                <p className="text-sm text-green-600 mt-1">
                  Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Associated Oil *</label>
              <select
                value={selectedOilId}
                onChange={(e) => setSelectedOilId(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
                required
              >
                <option value="GENERAL">General Documents (Not specific to any oil)</option>
                {oils.map(oil => (
                  <option key={oil.id} value={oil.id}>
                    {oil.tag} - {oil.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this document..."
              className="w-full border border-gray-300 rounded px-3 py-2"
              rows="2"
            />
          </div>

          <button
            type="submit"
            disabled={uploading || !selectedFile}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </form>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Filters
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2">
              <Search className="w-4 h-4 inline mr-1" />
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by filename, oil, notes..."
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Filter by Oil</label>
            <select
              value={filterOilId}
              onChange={(e) => setFilterOilId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="">All Oils</option>
              <option value="GENERAL">General Documents</option>
              {oils.map(oil => (
                <option key={oil.id} value={oil.id}>
                  {oil.tag} - {oil.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Filter by Type</label>
            <select
              value={filterFileType}
              onChange={(e) => setFilterFileType(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="">All Types</option>
              <option value="pdf">PDF</option>
              <option value="image">Images</option>
              <option value="sheet">Spreadsheets</option>
              <option value="document">Documents</option>
            </select>
          </div>
        </div>
      </div>

      {/* Attachments List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">
          Documents ({filteredAttachments.length})
        </h2>

        {loading ? (
          <p className="text-center py-8 text-gray-500">Loading...</p>
        ) : filteredAttachments.length === 0 ? (
          <p className="text-center py-8 text-gray-500">No documents found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-2">Type</th>
                  <th className="text-left py-3 px-2">File Name</th>
                  <th className="text-left py-3 px-2">Associated Oil</th>
                  <th className="text-left py-3 px-2">Size</th>
                  <th className="text-left py-3 px-2">Uploaded</th>
                  <th className="text-left py-3 px-2">Uploaded By</th>
                  <th className="text-left py-3 px-2">Notes</th>
                  <th className="text-center py-3 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttachments.map(att => (
                  <tr key={att.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2">
                      {getFileIcon(att.fileType)}
                    </td>
                    <td className="py-3 px-2 font-medium">{att.fileName}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        att.associatedOilId === 'GENERAL' 
                          ? 'bg-gray-200 text-gray-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {att.associatedOilName}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-sm">{formatFileSize(att.fileSize)}</td>
                    <td className="py-3 px-2 text-sm">{formatDate(att.uploadDate)}</td>
                    <td className="py-3 px-2 text-sm">{att.uploadedBy}</td>
                    <td className="py-3 px-2 text-sm text-gray-600">
                      {att.notes || '-'}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleDownload(att.filePath, att.fileName)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Download"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                        {currentUser.role === 'admin' && (
                          <button
                            onClick={() => handleDelete(att.id, att.fileName)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
