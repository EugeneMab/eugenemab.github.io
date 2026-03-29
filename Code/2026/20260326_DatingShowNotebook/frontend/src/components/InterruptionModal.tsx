import React from 'react';
import { useStore } from '../store/useStore';

const InterruptionModal: React.FC = () => {
  const { isInterrupted } = useStore();

  if (!isInterrupted) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full text-center border-4 border-red-500">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Interrupted</h2>
        <p className="text-gray-700 mb-6">
          Another client has taken control of this folder. Your session has been terminated to prevent data conflicts.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-full transition-colors shadow-lg"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
};

export default InterruptionModal;
