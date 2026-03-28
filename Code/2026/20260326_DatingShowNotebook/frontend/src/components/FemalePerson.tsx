import React from 'react';
import { Person } from '../store/useStore';
import { clsx } from 'clsx';

interface FemalePersonProps {
  person: Person;
  descriptionScale: number;
  isFirstSelected: boolean;
  onClick: (id: number) => void;
  onUpdate: (id: number, updates: Partial<Person>) => void;
  innerRef: (el: HTMLDivElement | null) => void;
}

const FemalePerson: React.FC<FemalePersonProps> = ({ person, descriptionScale, isFirstSelected, onClick, onUpdate, innerRef }) => {
  const handlePaste = async (e: React.ClipboardEvent) => {
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
              const minDim = Math.min(img.width, img.height);
              const sx = (img.width - minDim) / 2;
              const sy = (img.height - minDim) / 2;
              ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
              const base64 = canvas.toDataURL('image/png');
              onUpdate(person.id, { image: base64 });
            }
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(blob);
      }
    }
  };

  return (
    <div className="flex gap-4 items-start justify-start">
      <div 
        ref={innerRef}
        className={clsx(
          "w-[200px] h-[200px] border-2 rounded overflow-hidden cursor-pointer transition-transform shrink-0 flex items-center justify-center bg-gray-200",
          isFirstSelected && "ring-4 ring-blue-500 scale-105"
        )}
        onClick={() => onClick(person.id)}
        onPaste={handlePaste}
        tabIndex={0}
      >
        {person.image ? (
          <img 
            src={person.image} 
            alt={person.name} 
            className="w-full h-full object-cover" 
          />
        ) : (
          <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-500 text-xs px-2 text-center">No Image (Paste Here)</div>
        )}
      </div>
      <div className="flex flex-col text-left pt-2">
        <input
          className="font-bold text-lg leading-tight bg-transparent border-none text-left focus:ring-0 p-0"
          value={person.name}
          onChange={(e) => onUpdate(person.id, { name: e.target.value })}
        />
        <textarea
          className="text-sm text-gray-500 italic max-w-xs overflow-hidden bg-transparent border-none text-left focus:ring-0 p-0 resize-none"
          style={{ fontSize: `${descriptionScale}rem` }}
          value={person.description}
          rows={Math.max(2, person.description.split('\n').length)}
          onChange={(e) => onUpdate(person.id, { description: e.target.value })}
        />
      </div>
    </div>
  );
};

export default FemalePerson;
