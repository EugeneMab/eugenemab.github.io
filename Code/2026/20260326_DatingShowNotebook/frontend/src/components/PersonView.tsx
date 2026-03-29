import React, { useState, useMemo } from 'react';
import { useStore, Person, Gender } from '../store/useStore';
import { Plus, Trash2, Hash, ArrowUp, ArrowDown } from 'lucide-react';
import { clsx } from 'clsx';

// Constants for layout dimensions (Base values before scaling)
const PADDING = 20;
const COL_GAP = 40;
const HEADER_HEIGHT = 60;
const IMG_WIDTH = 200;
const TEXT_WIDTH = 350;
const ITEM_HEIGHT = 200;
const ROW_GAP = 20;
const BTN_HEIGHT = 60;

// Derived layout constants for horizontal positioning
const COL_WIDTH = IMG_WIDTH + TEXT_WIDTH + PADDING;
const X_MALE_COL = PADDING; // Start of male column
const X_FEMALE_COL = X_MALE_COL + COL_WIDTH + COL_GAP; // Start of female column
const TOTAL_WIDTH = X_FEMALE_COL + COL_WIDTH + PADDING;

const PersonView: React.FC = () => {
  const { data, saveData } = useStore();
  const { bodyScale = 1, descriptionScale = 1 } = data;
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);

  /**
   * Adds a new person to the store with default values.
   */
  const handleAddPerson = (gender: Gender) => {
    const id = data.nextUniqueId;
    const currentCount = data.people.filter((p) => p.gender === gender).length;
    const countLabel = currentCount + 1;

    const newPerson: Person = {
      id,
      gender,
      name: `${gender === 'male' ? 'Male' : 'Female'} ${countLabel}`,
      image: '',
      description: 'Add description...',
      ranges: '1',
    };
    saveData({
      ...data,
      people: [...data.people, newPerson],
      nextUniqueId: id + 1,
    });
  };

  /**
   * Deletes a person and all their associated messages and team memberships.
   */
  const handleDeletePerson = (id: number) => {
    if (!confirm('Are you sure you want to delete this person?')) return;
    
    saveData({
      ...data,
      people: data.people.filter((p) => p.id !== id),
      episodes: data.episodes.map(ep => ({
        ...ep,
        events: ep.events.map(ev => ({
          ...ev,
          messages: ev.messages.filter(m => m.from !== id && m.to !== id),
          teams: Object.fromEntries(
            Object.entries(ev.teams).map(([idx, members]) => [
              idx,
              members.filter(memId => memId !== id)
            ])
          )
        }))
      }))
    });
  };

  /**
   * Updates person details in the store.
   */
  const handleUpdatePerson = (id: number, updates: Partial<Person>) => {
    saveData({
      ...data,
      people: data.people.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    });
  };

  /**
   * Reorders a person in the list by moving them up or down.
   */
  const handleMovePerson = (id: number, direction: 'up' | 'down') => {
    const person = data.people.find(p => p.id === id);
    if (!person) return;

    const sameGenderPeople = data.people.filter(p => p.gender === person.gender);
    const index = sameGenderPeople.findIndex(p => p.id === id);

    if (direction === 'up' && index > 0) {
      const other = sameGenderPeople[index - 1];
      const newPeople = [...data.people];
      const idx1 = newPeople.findIndex(p => p.id === id);
      const idx2 = newPeople.findIndex(p => p.id === other.id);
      [newPeople[idx1], newPeople[idx2]] = [newPeople[idx2], newPeople[idx1]];
      saveData({ ...data, people: newPeople });
    } else if (direction === 'down' && index < sameGenderPeople.length - 1) {
      const other = sameGenderPeople[index + 1];
      const newPeople = [...data.people];
      const idx1 = newPeople.findIndex(p => p.id === id);
      const idx2 = newPeople.findIndex(p => p.id === other.id);
      [newPeople[idx1], newPeople[idx2]] = [newPeople[idx2], newPeople[idx1]];
      saveData({ ...data, people: newPeople });
    }
  };

  /**
   * Handles image paste into a person's image area.
   */
  const handlePaste = async (e: React.ClipboardEvent, personId: number) => {
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
              handleUpdatePerson(personId, { image: base64 });
            }
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(blob);
      }
    }
  };

  const males = useMemo(() => data.people.filter((p) => p.gender === 'male'), [data.people]);
  const females = useMemo(() => data.people.filter((p) => p.gender === 'female'), [data.people]);

  const scale = bodyScale;
  const descScale = descriptionScale;

  /**
   * Layout Height Logic:
   * Calculates the required height for both columns including headers, items, gaps, and buttons.
   * Uses the maximum of the two to ensure the SVG canvas covers both lists completely.
   */
  const maleTotalHeight =
    HEADER_HEIGHT + males.length * (ITEM_HEIGHT + ROW_GAP) + BTN_HEIGHT + PADDING;
  const femaleTotalHeight =
    HEADER_HEIGHT + females.length * (ITEM_HEIGHT + ROW_GAP) + BTN_HEIGHT + PADDING;
  const totalHeight = Math.max(maleTotalHeight, femaleTotalHeight) * scale;
  const totalWidth = TOTAL_WIDTH * scale;

  /**
   * Individual Person Rendering:
   * Calculates 'y' based on the item index and fixed heights/gaps.
   */
  const renderPerson = (person: Person, index: number, xOffset: number, isLast: boolean) => {
    const y = (HEADER_HEIGHT + index * (ITEM_HEIGHT + ROW_GAP)) * scale;
    const isSelected = selectedPersonId === person.id;

    return (
      <g key={person.id}>
        {/* Profile Image */}
        <foreignObject
          x={xOffset * scale}
          y={y}
          width={IMG_WIDTH * scale}
          height={ITEM_HEIGHT * scale}
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            className={clsx(
              'w-full h-full border-2 flex items-center justify-center cursor-pointer overflow-hidden bg-gray-200 shrink-0',
              isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'
            )}
            onClick={() => setSelectedPersonId(person.id)}
            onPaste={(e) => handlePaste(e, person.id)}
            tabIndex={0}
          >
            {person.image ? (
              <img src={person.image} alt={person.name} className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-500 text-center px-2"
                style={{ fontSize: `${0.75 * scale}rem` }}
              >
                Click & Paste Image
              </div>
            )}
          </div>
        </foreignObject>

        {/* Person Info & Controls */}
        <foreignObject
          x={(xOffset + IMG_WIDTH + PADDING) * scale}
          y={y}
          width={(TEXT_WIDTH - PADDING) * scale}
          height={ITEM_HEIGHT * scale}
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            className="flex flex-col gap-2 pt-2 h-full w-full"
          >
            <input
              className="font-bold bg-transparent border-none focus:ring-0 w-full p-0"
              style={{ fontSize: `${1.25 * scale}rem` }}
              value={person.name}
              onChange={(e) => handleUpdatePerson(person.id, { name: e.target.value })}
            />
            <textarea
              className="text-gray-600 bg-transparent border-none focus:ring-0 w-full resize-none p-0 overflow-hidden"
              style={{ fontSize: `${scale * descScale}rem`, height: `${100 * scale}px` }}
              value={person.description}
              onChange={(e) => handleUpdatePerson(person.id, { description: e.target.value })}
            />
            <div className="flex gap-2 items-center">
              {/* Range Editor */}
              <button
                className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded whitespace-nowrap"
                style={{ fontSize: `${0.75 * scale}rem` }}
                onClick={() => {
                  const ranges = prompt('Enter episode ranges (e.g. "2 4 7"):', person.ranges);
                  if (ranges !== null) handleUpdatePerson(person.id, { ranges });
                }}
              >
                <Hash size={14 * scale} /> Range: {person.ranges}
              </button>

              {/* Move Controls */}
              <button
                className={clsx(
                  "p-1 rounded hover:bg-gray-200 bg-gray-100",
                  index === 0 && "opacity-20 cursor-not-allowed"
                )}
                disabled={index === 0}
                onClick={() => handleMovePerson(person.id, 'up')}
                title="Move Up"
              >
                <ArrowUp size={16 * scale} />
              </button>
              <button
                className={clsx(
                  "p-1 rounded hover:bg-gray-200 bg-gray-100",
                  isLast && "opacity-20 cursor-not-allowed"
                )}
                disabled={isLast}
                onClick={() => handleMovePerson(person.id, 'down')}
                title="Move Down"
              >
                <ArrowDown size={16 * scale} />
              </button>

              {/* Delete Button */}
              <button
                className="flex items-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded ml-auto"
                style={{ fontSize: `${0.75 * scale}rem` }}
                onClick={() => handleDeletePerson(person.id)}
              >
                <Trash2 size={14 * scale} /> Delete
              </button>
            </div>
          </div>
        </foreignObject>
      </g>
    );
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50 relative">
      <svg
        width={totalWidth}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="bg-white shadow-lg block mx-auto"
        style={{ minWidth: totalWidth, minHeight: totalHeight }}
      >
        {/* Column Headers */}
        <foreignObject
          x={X_MALE_COL * scale}
          y={0}
          width={COL_WIDTH * scale}
          height={HEADER_HEIGHT * scale}
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            className="w-full h-full flex items-center font-bold border-b border-gray-200 bg-gray-50 uppercase tracking-wider text-gray-500 px-4"
            style={{ fontSize: `${0.875 * scale}rem` }}
          >
            Males
          </div>
        </foreignObject>
        <foreignObject
          x={X_FEMALE_COL * scale}
          y={0}
          width={COL_WIDTH * scale}
          height={HEADER_HEIGHT * scale}
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            className="w-full h-full flex items-center font-bold border-b border-gray-200 bg-gray-50 uppercase tracking-wider text-gray-500 px-4"
            style={{ fontSize: `${0.875 * scale}rem` }}
          >
            Females
          </div>
        </foreignObject>

        {/* Male Participants List */}
        {males.map((p, i) => renderPerson(p, i, X_MALE_COL, i === males.length - 1))}
        <foreignObject
          x={X_MALE_COL * scale}
          y={(HEADER_HEIGHT + males.length * (ITEM_HEIGHT + ROW_GAP)) * scale}
          width={COL_WIDTH * scale}
          height={BTN_HEIGHT * scale}
        >
          <div xmlns="http://www.w3.org/1999/xhtml" className="w-full h-full">
            <button
              className="w-full h-full flex items-center justify-center gap-2 text-blue-600 hover:bg-blue-50 transition-colors border-t border-gray-100"
              style={{ fontSize: `${1 * scale}rem` }}
              onClick={() => handleAddPerson('male')}
            >
              <Plus size={20 * scale} /> Add Male
            </button>
          </div>
        </foreignObject>

        {/* Female Participants List */}
        {females.map((p, i) => renderPerson(p, i, X_FEMALE_COL, i === females.length - 1))}
        <foreignObject
          x={X_FEMALE_COL * scale}
          y={(HEADER_HEIGHT + females.length * (ITEM_HEIGHT + ROW_GAP)) * scale}
          width={COL_WIDTH * scale}
          height={BTN_HEIGHT * scale}
        >
          <div xmlns="http://www.w3.org/1999/xhtml" className="w-full h-full">
            <button
              className="w-full h-full flex items-center justify-center gap-2 text-pink-600 hover:bg-pink-50 transition-colors border-t border-gray-100"
              style={{ fontSize: `${1 * scale}rem` }}
              onClick={() => handleAddPerson('female')}
            >
              <Plus size={20 * scale} /> Add Female
            </button>
          </div>
        </foreignObject>
      </svg>
    </div>
  );
};

export default PersonView;
