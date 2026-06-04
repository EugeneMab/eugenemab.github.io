import { html, LucideReact } from '../utils/html.js';

export const PersonView = ({ data, setData }) => {
  const addPerson = (gender) => {
    setData(prev => ({
      ...prev,
      people: [...prev.people, {
        id: prev.nextUniqueId,
        name: 'New ' + gender,
        gender,
        description: '',
        image: '',
        ranges: ''
      }],
      nextUniqueId: prev.nextUniqueId + 1
    }));
  };

  const removePerson = (id) => {
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

  return html`
    <div className="flex-1 overflow-auto bg-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b pb-4">
          <h1 className="text-3xl font-bold text-gray-800">Participants</h1>
          <div className="flex gap-4">
            <button onClick=${() => addPerson('male')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md">
              <${LucideReact.Plus} size=${18} /> Add Male
            </button>
            <button onClick=${() => addPerson('female')} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-md">
              <${LucideReact.Plus} size=${18} /> Add Female
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          ${data.people.map(p => html`
            <div key=${p.id} className="bg-gray-50 p-6 rounded-xl border border-gray-200 flex gap-6 shadow-sm hover:shadow-md transition-shadow relative group">
              <button 
                onClick=${() => removePerson(p.id)}
                className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <${LucideReact.Trash2} size=${18} />
              </button>

              <div 
                className="w-32 h-32 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0 border-2 cursor-pointer flex items-center justify-center text-gray-400"
                onPaste=${e => handlePaste(e, p.id)}
                tabIndex="0"
              >
                ${p.image ? html`<img src=${p.image} className="w-full h-full object-cover" />` : html`<div className="text-[10px] text-center px-1">Paste Image Here</div>`}
              </div>

              <div className="flex-1 space-y-3">
                <input 
                  className=${`font-bold text-xl bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-0 w-full ${p.gender === 'male' ? 'text-blue-900' : 'text-red-900'}`}
                  value=${p.name}
                  onChange=${e => updatePerson(p.id, { name: e.target.value })}
                />
                <textarea 
                  placeholder="Description..."
                  className="w-full bg-transparent border rounded p-1 text-sm text-gray-600 focus:ring-1 focus:ring-blue-500 outline-none resize-none h-20"
                  value=${p.description}
                  onChange=${e => updatePerson(p.id, { description: e.target.value })}
                ></textarea>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-mono">Visible Episodes:</span>
                  <input 
                    placeholder="e.g. 1 5 6"
                    className="flex-1 text-xs font-mono bg-white border rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
                    value=${p.ranges}
                    onChange=${e => updatePerson(p.id, { ranges: e.target.value })}
                  />
                </div>
              </div>
            </div>
          `)}
        </div>

        ${data.people.length === 0 && html`
          <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <${LucideReact.Users} size=${64} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-400">No participants added yet. Use the buttons above to add participants.</p>
          </div>
        `}
      </div>
    </div>
  `;
};
