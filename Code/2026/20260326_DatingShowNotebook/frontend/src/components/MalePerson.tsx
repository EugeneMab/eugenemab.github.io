import React from 'react';
import { Person } from '../store/useStore';
import { clsx } from 'clsx';

interface MalePersonProps {
  person: Person;
  descriptionScale: number;
  isFirstSelected: boolean;
  onClick: (id: number) => void;
  innerRef: (el: HTMLDivElement | null) => void;
}

const MalePerson: React.FC<MalePersonProps> = ({ person, descriptionScale, isFirstSelected, onClick, innerRef }) => {
  return (
    <div className="flex gap-4 items-center justify-end">
      <div className="flex flex-col text-right">
        <div className="font-bold text-lg leading-tight">{person.name}</div>
        <div 
          className="text-sm text-gray-500 italic max-w-xs overflow-hidden" 
          style={{ fontSize: `${descriptionScale}rem` }}
        >
          {person.description}
        </div>
      </div>
      <div 
        ref={innerRef}
        className={clsx(
          "w-24 h-24 border-2 rounded overflow-hidden cursor-pointer transition-transform shrink-0",
          isFirstSelected && "ring-4 ring-blue-500 scale-105"
        )}
        onClick={() => onClick(person.id)}
      >
        <img 
          src={person.image || 'https://via.placeholder.com/200'} 
          alt={person.name} 
          className="w-full h-full object-cover" 
        />
      </div>
    </div>
  );
};

export default MalePerson;
