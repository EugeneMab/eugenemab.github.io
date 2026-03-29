import React from 'react';
import { useStore } from './store/useStore';
import NavigationPane from './components/NavigationPane';
import TopButtonPane from './components/TopButtonPane';
import MainBody from './components/MainBody';
import PersonView from './components/PersonView';
import ProgressModal from './components/ProgressModal';
import InterruptionModal from './components/InterruptionModal';
import { FolderOpen } from 'lucide-react';

const App: React.FC = () => {
  const { selectedEpisodeId, currentFolderPath } = useStore();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-100 text-gray-900">
      {currentFolderPath && <NavigationPane />}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        <TopButtonPane />
        <div className="flex-1 overflow-auto bg-white relative">
          {!currentFolderPath ? (
            <div className="flex-1 flex flex-col items-center justify-center h-full bg-gray-50">
              <div className="bg-white p-12 rounded-2xl shadow-xl text-center max-w-lg border border-gray-100">
                <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FolderOpen size={40} />
                </div>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Dating Show Notebook</h1>
                <p className="text-gray-600 mb-0 leading-relaxed">
                  Please click the folder icon at the top right to open a data folder.
                </p>
              </div>
            </div>
          ) : (
            selectedEpisodeId === null ? <PersonView /> : <MainBody />
          )}
        </div>
      </div>
      <ProgressModal />
      <InterruptionModal />
    </div>
  );
};

export default App;
