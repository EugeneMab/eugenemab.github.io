import React from 'react';
import { useStore } from '../store/useStore';

const ProgressModal: React.FC = () => {
  const { isRefreshing, refreshProgress, setCancelRefresh } = useStore();

  if (!isRefreshing) return null;

  const { current, total } = refreshProgress;
  const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] backdrop-blur-sm">
      <div className="bg-white rounded-xl p-8 w-[450px] shadow-2xl border border-gray-100">
        <h3 className="text-2xl font-bold mb-2 text-gray-900 text-center">Generating Images</h3>
        <p className="text-gray-500 text-center mb-8">Processing all events for JPEG export...</p>
        
        <div className="w-full bg-gray-100 rounded-full h-6 mb-3 p-1 border border-gray-200">
          <div 
            className="bg-blue-600 h-full rounded-full transition-[width] duration-200 ease-out"
            style={{ 
              width: `${percentage}%`,
              minWidth: current > 0 ? '20px' : '0'
            }}
          ></div>
        </div>
        
        <div className="flex justify-between text-base font-medium text-gray-700 mb-8 px-1">
          <span>{percentage}% Complete</span>
          <span>{current} / {total} Steps</span>
        </div>
        
        <div className="flex justify-center">
          <button
            className="px-8 py-3 bg-white text-red-600 border-2 border-red-100 rounded-lg hover:bg-red-50 hover:border-red-200 transition-all font-bold shadow-sm"
            onClick={() => setCancelRefresh(true)}
          >
            Cancel Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProgressModal;
