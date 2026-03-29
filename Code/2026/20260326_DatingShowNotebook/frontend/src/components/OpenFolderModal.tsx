import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Folder, ChevronRight, ChevronLeft, FileJson, Clock, X } from 'lucide-react';
import axios from 'axios';

interface FolderEntry {
  name: string;
  path: string;
  hasDataJson: boolean;
}

interface BrowseResponse {
  currentPath: string;
  parentPath: string | null;
  folders: FolderEntry[];
}

interface OpenFolderModalProps {
  onClose: () => void;
}

const OpenFolderModal: React.FC<OpenFolderModalProps> = ({ onClose }) => {
  const { openFolder, recentFolders } = useStore();
  const [currentPath, setCurrentPath] = useState('');
  const [data, setData] = useState<BrowseResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const browse = async (path: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/browse?path=${encodeURIComponent(path)}`);
      setData(res.data);
      setCurrentPath(res.data.currentPath);
    } catch (e) {
      console.error('Failed to browse', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    browse('');
  }, []);

  const handleSelect = async (path: string) => {
    await openFolder(path);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[50] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Folder className="text-blue-600" />
            Open Data Folder
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {recentFolders.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Clock size={16} />
                Recent Folders
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {recentFolders.map((path) => (
                  <button
                    key={path}
                    onClick={() => handleSelect(path)}
                    className="flex items-center gap-3 p-3 text-left hover:bg-blue-50 rounded-lg border border-gray-100 group transition-all"
                  >
                    <Folder
                      className="text-blue-400 group-hover:text-blue-600 shrink-0"
                      size={20}
                    />
                    <span className="truncate flex-1 font-medium">
                      {path === '.' ? '(Root)' : path}
                    </span>
                    <ChevronRight className="text-gray-300 group-hover:text-blue-400" size={18} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Folder size={16} />
              Browse System
            </h3>

            <div className="mb-4 flex items-center gap-2 text-sm text-gray-600 bg-gray-100 p-2 rounded truncate">
              <span className="font-semibold shrink-0">Current:</span>
              <span className="truncate">{currentPath === '.' ? '/' : `/${currentPath}`}</span>
            </div>

            <div className="space-y-1">
              {data?.parentPath !== null && data?.parentPath !== undefined && (
                <button
                  onClick={() => browse(data!.parentPath!)}
                  className="flex items-center gap-3 p-2 w-full text-left hover:bg-gray-100 rounded group"
                >
                  <ChevronLeft className="text-gray-400 group-hover:text-gray-600" size={20} />
                  <span className="font-medium text-gray-600">.. (Parent Directory)</span>
                </button>
              )}

              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading...</div>
              ) : (
                data?.folders.map((f) => (
                  <div key={f.path} className="flex items-center gap-2 group p-1">
                    <button
                      onClick={() => browse(f.path)}
                      className="flex items-center gap-3 p-2 flex-1 text-left hover:bg-gray-100 rounded transition-colors"
                    >
                      <Folder className="text-yellow-500 shrink-0" size={20} />
                      <span className="flex-1 truncate">{f.name}</span>
                      {f.hasDataJson && (
                        <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded uppercase">
                          <FileJson size={12} />
                          Data
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => handleSelect(f.path)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                    >
                      Open
                    </button>
                  </div>
                ))
              )}

              {!loading && data?.folders.length === 0 && (
                <div className="p-8 text-center text-gray-400 italic">No subfolders found</div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
          <p className="text-xs text-gray-500 italic">Select a folder to manage its data.</p>
          <button
            onClick={() => handleSelect(currentPath)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded shadow-sm transition-colors"
          >
            Select Current Folder
          </button>
        </div>
      </div>
    </div>
  );
};

export default OpenFolderModal;
