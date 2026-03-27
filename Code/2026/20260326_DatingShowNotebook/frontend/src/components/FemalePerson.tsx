import React from 'react';
import { Person } from '../store/useStore';
import { clsx } from 'clsx';

interface FemalePersonProps {
  person: Person;
  descriptionScale: number;
  isFirstSelected: boolean;
  onClick: (id: number) => void;
  innerRef: (el: HTMLDivElement | null) => void;
}

const FemalePerson: React.FC<FemalePersonProps> = ({ person, descriptionScale, isFirstSelected, onClick, innerRef }) => {
  return (
    <div className="flex gap-4 items-start justify-start">
      <div 
        ref={innerRef}
        className={clsx(
          "w-[200px] h-[200px] border-2 rounded overflow-hidden cursor-pointer transition-transform shrink-0 flex items-center justify-center bg-gray-200",
          isFirstSelected && "ring-4 ring-blue-500 scale-105"
        )}
        onClick={() => onClick(person.id)}
      >
        {person.image ? (
          <img 
            src={person.image} 
            alt={person.name} 
            className="w-full h-full object-cover" 
          />
        ) : (
          <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-500">No Image</div>
        )}
      </div>
      <div className="flex flex-col text-left pt-2">
        <div className="font-bold text-lg leading-tight">{person.name}</div>
        <div 
          className="text-sm text-gray-500 italic max-w-xs overflow-hidden" 
          style={{ fontSize: `${descriptionScale}rem` }}
        >
          {person.description}
        </div>
      </div>
    </div>
  );
};

export default FemalePerson;
