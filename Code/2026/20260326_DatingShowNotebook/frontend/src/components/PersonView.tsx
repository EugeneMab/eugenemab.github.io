import React, { useState, useEffect } from 'react';
import { useStore, Person, Gender } from '../store/useStore';
import { Plus, Trash2, Hash } from 'lucide-react';

const PersonView: React.FC = () => {
  const { data, saveData } = useStore();
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);

  const handleAddPerson = (gender: Gender) => {
    const id = data.nextPersonId;
    const newPerson: Person = {
      id,
      gender,
      name: `${gender === 'male' ? 'Male' : 'Female'} ${id}`,
      image: '',
      description: 'Add description...',
      ranges: '1'
    };
    saveData({
      ...data,
      people: [...data.people, newPerson],
      nextPersonId: id + 1
    });
  };

  const handleDeletePerson = (id: number) => {
    saveData({
      ...data,
      people: data.people.filter(p => p.id !== id)
    });
  };

  const handleUpdatePerson = (id: number, updates: Partial<Person>) => {
    saveData({
      ...data,
      people: data.people.map(p => p.id === id ? { ...p, ...updates } : p)
    });
  };

  const handlePaste = async (e: ClipboardEvent) => {
    if (selectedPersonId === null) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        if (!blob) continue;

        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 200;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Center crop
              const minDim = Math.min(img.width, img.height);
              const sx = (img.width - minDim) / 2;
              const sy = (img.height - minDim) / 2;
              ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
              const base64 = canvas.toDataURL('image/png');
              handleUpdatePerson(selectedPersonId, { image: base64 });
            }
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(blob);
      }
    }
  };

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [selectedPersonId]);

  const renderPerson = (person: Person) => (
    <div key={person.id} className="flex border-b border-gray-200 p-4 gap-4 items-start group">
      <div 
        className={`w-[200px] h-[200px] border-2 flex items-center justify-center cursor-pointer overflow-hidden ${selectedPersonId === person.id ? 'border-blue-500' : 'border-gray-300'}`}
        onClick={() => setSelectedPersonId(person.id)}
      >
        {person.image ? (
          <img src={person.image} alt={person.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-gray-400">Click & Paste Image</span>
        )}
      </div>
      <div className="flex-1 flex flex-col gap-2">
        <input
          className="text-xl font-bold bg-transparent border-none focus:ring-0 w-full"
          value={person.name}
          onChange={(e) => handleUpdatePerson(person.id, { name: e.target.value })}
        />
        <textarea
          className="text-gray-600 bg-transparent border-none focus:ring-0 w-full resize-none"
          rows={4}
          value={person.description}
          onChange={(e) => handleUpdatePerson(person.id, { description: e.target.value })}
        />
        <div className="flex gap-2">
          <button
            className="flex items-center gap-1 text-sm bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
            onClick={() => {
              const ranges = prompt('Enter episode ranges (e.g. "2 4 7"):', person.ranges);
              if (ranges !== null) handleUpdatePerson(person.id, { ranges });
            }}
          >
            <Hash size={14} /> Range: {person.ranges}
          </button>
          <button
            className="flex items-center gap-1 text-sm bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => handleDeletePerson(person.id)}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
    </div>
  );

  const males = data.people.filter(p => p.gender === 'male');
  const females = data.people.filter(p => p.gender === 'female');

  return (
    <div className="flex h-full">
      <div className="flex-1 border-r border-gray-200 overflow-y-auto">
        <div className="p-4 font-bold border-b border-gray-200 bg-gray-50 uppercase tracking-wider text-sm text-gray-500">Males</div>
        {males.map(renderPerson)}
        <button
          className="w-full p-4 flex items-center justify-center gap-2 text-blue-600 hover:bg-blue-50 transition-colors"
          onClick={() => handleAddPerson('male')}
        >
          <Plus size={20} /> Add Male
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 font-bold border-b border-gray-200 bg-gray-50 uppercase tracking-wider text-sm text-gray-500">Females</div>
        {females.map(renderPerson)}
        <button
          className="w-full p-4 flex items-center justify-center gap-2 text-pink-600 hover:bg-pink-50 transition-colors"
          onClick={() => handleAddPerson('female')}
        >
          <Plus size={20} /> Add Female
        </button>
      </div>
    </div>
  );
};

export default PersonView;
