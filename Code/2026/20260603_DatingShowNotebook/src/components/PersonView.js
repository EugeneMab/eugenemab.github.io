import { html, React, LucideReact } from '../utils/html.js';
import { 
  PADDING, ROW_GAP, TITLE_HEIGHT, MALE_TEXT_WIDTH, MALE_IMG_WIDTH, MID_WIDTH, FEMALE_IMG_WIDTH, FEMALE_TEXT_WIDTH, IMG_HEIGHT,
  X_MALE_TEXT, X_MALE_IMG, X_MID, X_FEMALE_IMG, X_FEMALE_TEXT, TOTAL_WIDTH,
  NAME_FONT_SIZE, DESC_FONT_SIZE, SMALL_FONT_SIZE
} from '../utils/layout.js';

const { useMemo } = React;

const ITEM_HEIGHT = IMG_HEIGHT;
const COL_WIDTH = MALE_IMG_WIDTH + MALE_TEXT_WIDTH + PADDING;
const X_MALE_COL = X_MALE_TEXT;
const X_FEMALE_COL = X_FEMALE_IMG;
const BTN_HEIGHT = 60;

export const PersonView = ({ data, setData }) => {
  const { bodyScale = 1, descriptionScale = 1 } = data;

  const addPerson = (gender) => {
    setData(prev => ({
      ...prev,
      people: [...prev.people, {
        id: prev.nextUniqueId,
        name: (gender === 'male' ? 'Male ' : 'Female ') + (prev.people.filter(p => p.gender === gender).length + 1),
        gender,
        description: '',
        image: '',
        ranges: '1'
      }],
      nextUniqueId: prev.nextUniqueId + 1
    }));
  };

  const removePerson = (id) => {
    if (!confirm('Delete this participant?')) return;
    setData(prev => ({
      ...prev,
      people: prev.people.filter(p => p.id !== id)
    }));
  };

  const updatePerson = (id, updates) => {
    setData(prev => ({
      ...prev,
      people: prev.people.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  };

  const movePerson = (id, direction) => {
    setData(prev => {
      const person = prev.people.find(p => p.id === id);
      if (!person) return prev;
      const sameGender = prev.people.filter(p => p.gender === person.gender);
      const idx = sameGender.findIndex(p => p.id === id);
      if (direction === 'up' && idx > 0) {
        const other = sameGender[idx - 1];
        const newPeople = [...prev.people];
        const i1 = newPeople.findIndex(p => p.id === id);
        const i2 = newPeople.findIndex(p => p.id === other.id);
        [newPeople[i1], newPeople[i2]] = [newPeople[i2], newPeople[i1]];
        return { ...prev, people: newPeople };
      }
      if (direction === 'down' && idx < sameGender.length - 1) {
        const other = sameGender[idx + 1];
        const newPeople = [...prev.people];
        const i1 = newPeople.findIndex(p => p.id === id);
        const i2 = newPeople.findIndex(p => p.id === other.id);
        [newPeople[i1], newPeople[i2]] = [newPeople[i2], newPeople[i1]];
        return { ...prev, people: newPeople };
      }
      return prev;
    });
  };

  const handlePaste = (e, id) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = (event) => updatePerson(id, { image: event.target.result });
        reader.readAsDataURL(blob);
      }
    }
  };

  const males = useMemo(() => data.people.filter(p => p.gender === 'male'), [data.people]);
  const females = useMemo(() => data.people.filter(p => p.gender === 'female'), [data.people]);

  const scale = bodyScale;
  const descScale = descriptionScale;

  const maleTotalHeight = TITLE_HEIGHT + males.length * (ITEM_HEIGHT + ROW_GAP) + BTN_HEIGHT + PADDING;
  const femaleTotalHeight = TITLE_HEIGHT + females.length * (ITEM_HEIGHT + ROW_GAP) + BTN_HEIGHT + PADDING;
  const totalHeight = Math.max(maleTotalHeight, femaleTotalHeight) * scale;
  const totalWidth = TOTAL_WIDTH * scale;

  const renderPerson = (p, i, xOffset, isLast) => {
    const y = (TITLE_HEIGHT + i * (ITEM_HEIGHT + ROW_GAP)) * scale;
    const isMale = p.gender === 'male';

    return html`
      <g key=${p.id}>
        <foreignObject x=${xOffset * scale} y=${y} width=${(isMale ? MALE_IMG_WIDTH : FEMALE_IMG_WIDTH) * scale} height=${ITEM_HEIGHT * scale}>
          <div 
            xmlns="http://www.w3.org/1999/xhtml" 
            className="w-full h-full border-2 border-gray-300 flex items-center justify-center cursor-pointer overflow-hidden bg-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
            onPaste=${e => handlePaste(e, p.id)}
            tabIndex="0"
            aria-label="Paste participant image"
            title="Paste an image from the clipboard"
          >
            ${p.image ? html`<img src=${p.image} className="w-full h-full object-cover" />` : html`<div className="text-gray-400 text-center px-1" style=${{ fontSize: `${SMALL_FONT_SIZE * scale}rem` }}>Paste Image</div>`}
          </div>
        </foreignObject>

        <foreignObject x=${(xOffset + (isMale ? MALE_IMG_WIDTH : FEMALE_IMG_WIDTH) + PADDING) * scale} y=${y} width=${(isMale ? MALE_TEXT_WIDTH : FEMALE_TEXT_WIDTH) * scale} height=${ITEM_HEIGHT * scale}>
          <div xmlns="http://www.w3.org/1999/xhtml" className="flex flex-col gap-2 pt-2 h-full w-full">
            <input 
              className=${`font-bold bg-transparent border-none focus:ring-0 w-full p-0 ${isMale ? 'text-blue-900' : 'text-red-900'}`}
              style=${{ fontSize: `${NAME_FONT_SIZE * scale}rem` }}
              value=${p.name}
              onChange=${e => updatePerson(p.id, { name: e.target.value })}
            />
            <textarea 
              className=${`bg-transparent border-none focus:ring-0 w-full resize-none p-0 overflow-hidden ${isMale ? 'text-blue-800' : 'text-red-800'}`}
              style=${{ fontSize: `${DESC_FONT_SIZE * scale * descScale}rem`, height: `${100 * scale}px` }}
              value=${p.description}
              onChange=${e => updatePerson(p.id, { description: e.target.value })}
            />
            <div className="flex gap-2 items-center">
              <button 
                className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-600 whitespace-nowrap"
                style=${{ fontSize: `${SMALL_FONT_SIZE * scale}rem` }}
                onClick=${() => {
                  const ranges = prompt('Enter episode ranges (e.g. "1 5 6"):', p.ranges);
                  if (ranges !== null) updatePerson(p.id, { ranges });
                }}
              >
                <${LucideReact.Hash} size=${14} * scale} /> Range: ${p.ranges}
              </button>

              <button title="Move up" aria-label="Move up" disabled=${i === 0} onClick=${() => movePerson(p.id, 'up')} className=${`p-1 rounded hover:bg-gray-200 bg-gray-100 ${i === 0 ? 'opacity-20' : ''}`}><${LucideReact.ArrowUp} size=${16 * scale} /></button>
              <button title="Move down" aria-label="Move down" disabled=${isLast} onClick=${() => movePerson(p.id, 'down')} className=${`p-1 rounded hover:bg-gray-200 bg-gray-100 ${isLast ? 'opacity-20' : ''}`}><${LucideReact.ArrowDown} size=${16 * scale} /></button>
              
              <button 
                onClick=${() => removePerson(p.id)}
                className="flex items-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded ml-auto"
                style=${{ fontSize: `${SMALL_FONT_SIZE * scale}rem` }}
              >
                <${LucideReact.Trash2} size=${14 * scale} /> Delete
              </button>
            </div>
          </div>
        </foreignObject>
      </g>
    `;
  };

  return html`
    <div className="flex-1 overflow-auto bg-gray-50 relative p-8">
      <div className="min-w-max mx-auto shadow-2xl">
        <svg width=${totalWidth} height=${totalHeight} viewBox=${`0 0 ${totalWidth} ${totalHeight}`} className="bg-white block">
          <foreignObject x=${X_MALE_COL * scale} y="0" width=${COL_WIDTH * scale} height=${TITLE_HEIGHT * scale}>
            <div xmlns="http://www.w3.org/1999/xhtml" className="w-full h-full flex items-center font-bold border-b bg-gray-50 uppercase tracking-wider text-gray-500 px-4" style=${{ fontSize: `${0.875 * scale}rem` }}>Males</div>
          </foreignObject>
          <foreignObject x=${X_FEMALE_COL * scale} y="0" width=${COL_WIDTH * scale} height=${TITLE_HEIGHT * scale}>
            <div xmlns="http://www.w3.org/1999/xhtml" className="w-full h-full flex items-center font-bold border-b bg-gray-50 uppercase tracking-wider text-gray-500 px-4" style=${{ fontSize: `${0.875 * scale}rem` }}>Females</div>
          </foreignObject>

          ${males.map((p, i) => renderPerson(p, i, X_MALE_COL, i === males.length - 1))}
          <foreignObject x=${X_MALE_COL * scale} y=${(TITLE_HEIGHT + males.length * (ITEM_HEIGHT + ROW_GAP)) * scale} width=${COL_WIDTH * scale} height=${BTN_HEIGHT * scale}>
            <div xmlns="http://www.w3.org/1999/xhtml" className="w-full h-full">
              <button onClick=${() => addPerson('male')} className="w-full h-full flex items-center justify-center gap-2 text-blue-600 hover:bg-blue-50 transition-colors border-t" style=${{ fontSize: `${1 * scale}rem` }}>
                <${LucideReact.Plus} size=${20 * scale} /> Add Male
              </button>
            </div>
          </foreignObject>

          ${females.map((p, i) => renderPerson(p, i, X_FEMALE_COL, i === females.length - 1))}
          <foreignObject x=${X_FEMALE_COL * scale} y=${(TITLE_HEIGHT + females.length * (ITEM_HEIGHT + ROW_GAP)) * scale} width=${COL_WIDTH * scale} height=${BTN_HEIGHT * scale}>
            <div xmlns="http://www.w3.org/1999/xhtml" className="w-full h-full">
              <button onClick=${() => addPerson('female')} className="w-full h-full flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 transition-colors border-t" style=${{ fontSize: `${1 * scale}rem` }}>
                <${LucideReact.Plus} size=${20 * scale} /> Add Female
              </button>
            </div>
          </foreignObject>
        </svg>
      </div>
    </div>
  `;
};

