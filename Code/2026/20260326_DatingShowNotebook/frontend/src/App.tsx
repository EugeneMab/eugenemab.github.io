import React, { useEffect } from 'react';
import { useStore } from './store/useStore';
import NavigationPane from './components/NavigationPane';
import TopButtonPane from './components/TopButtonPane';
import MainBody from './components/MainBody';
import PersonView from './components/PersonView';

const App: React.FC = () => {
  const { fetchData, selectedEpisodeId } = useStore();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-100 text-gray-900">
      <NavigationPane />
      <div className="flex flex-col flex-1 min-w-0 h-full">
        <TopButtonPane />
        <div className="flex-1 overflow-auto bg-white relative">
          {selectedEpisodeId === null ? (
            <PersonView />
          ) : (
            <MainBody />
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
