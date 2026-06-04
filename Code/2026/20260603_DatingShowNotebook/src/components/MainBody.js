import { html, React } from '../utils/html.js';
import { 
  PADDING, ROW_GAP, TITLE_HEIGHT, MALE_TEXT_WIDTH, MALE_IMG_WIDTH, MID_WIDTH, FEMALE_IMG_WIDTH, FEMALE_TEXT_WIDTH, IMG_HEIGHT,
  X_MALE_TEXT, X_MALE_IMG, X_MID, X_FEMALE_IMG, X_FEMALE_TEXT, TOTAL_WIDTH,
  getFilteredPeople, calculatePersonPositions, getMessageStyle, calculateMessageCoords, calculatTeamMemberCoords, TEAM_COLORS,
  SELECTION_PADDING, SELECTION_STROKE_WIDTH, SELECTION_CORNER_RADIUS, MESSAGE_STROKE_WIDTH, TEAM_HUB_RADIUS, TEAM_LINE_STROKE_WIDTH,
  TITLE_FONT_SIZE, NAME_FONT_SIZE, DESC_FONT_SIZE, SMALL_FONT_SIZE
} from '../utils/layout.js';

const { useMemo, useState } = React;

export const MainBody = ({ data, setData, activeMode, selectedEpisodeId, selectedEventId }) => {
  const [firstPersonId, setFirstPersonId] = useState(null);

  const currentEvent = useMemo(() => {
    for (const ep of data.episodes) {
      const ev = ep.events.find(e => e.id === selectedEventId);
      if (ev) return ev;
    }
    return null;
  }, [data.episodes, selectedEventId]);

  const episodeIndex = useMemo(() => {
    if (selectedEpisodeId === null) return -1;
    return data.episodes.findIndex(ep => ep.id === selectedEpisodeId) + 1;
  }, [data.episodes, selectedEpisodeId]);

  const filteredPeople = useMemo(() => getFilteredPeople(data, episodeIndex), [data, episodeIndex]);

  const males = useMemo(() => filteredPeople.filter(p => p.gender === 'male'), [filteredPeople]);
  const females = useMemo(() => filteredPeople.filter(p => p.gender === 'female'), [filteredPeople]);

  const scale = data.bodyScale || 1;
  const descScale = data.descriptionScale || 1;
  const numRows = Math.max(males.length, females.length);

  const totalWidth = TOTAL_WIDTH * scale;
  const totalHeight = (TITLE_HEIGHT + PADDING + numRows * (IMG_HEIGHT + ROW_GAP)) * scale;

  const personPositions = useMemo(() => calculatePersonPositions(males, females, scale), [males, females, scale]);

  const handleUpdatePerson = (id, updates) => {
    setData(prev => ({
      ...prev,
      people: prev.people.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  };

  const handlePersonClick = (personId) => {
    if (!selectedEventId) return;

    if (activeMode.includes('message')) {
      if (firstPersonId === null) {
        setFirstPersonId(personId);
      } else {
        if (firstPersonId !== personId) {
          setData(prev => {
            const p1 = prev.people.find(p => p.id === firstPersonId);
            const p2 = prev.people.find(p => p.id === personId);
            if (!p1 || !p2) return prev;

            const type = activeMode === 'bidirectional-message' ? 'bidirectional' : activeMode === 'message' ? 'strong' : 'weak';
            
            return {
              ...prev,
              episodes: prev.episodes.map(ep => ({
                ...ep,
                events: ep.events.map(ev => ev.id === selectedEventId ? {
                  ...ev,
                  messages: [...ev.messages, { from: firstPersonId, to: personId, type }]
                } : ev)
              }))
            };
          });
        }
        setFirstPersonId(null);
      }
    } else if (activeMode === 'eraser') {
      setData(prev => ({
        ...prev,
        episodes: prev.episodes.map(ep => ({
          ...ep,
          events: ep.events.map(ev => ev.id === selectedEventId ? {
            ...ev,
            messages: ev.messages.filter(m => m.from !== personId && m.to !== personId),
            teams: Object.fromEntries(Object.entries(ev.teams).map(([idx, members]) => [idx, members.filter(id => id !== personId)]))
          } : ev)
        }))
      }));
    } else if (activeMode.startsWith('team-')) {
      const teamIdx = activeMode.split('-')[1];
      setData(prev => ({
        ...prev,
        episodes: prev.episodes.map(ep => ({
          ...ep,
          events: ep.events.map(ev => ev.id === selectedEventId ? {
            ...ev,
            teams: { ...ev.teams, [teamIdx]: Array.from(new Set([...(ev.teams[teamIdx] || []), personId])) }
          } : ev)
        }))
      }));
    }
  };

  const handlePaste = async (e, personId) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = (event) => {
          handleUpdatePerson(personId, { image: event.target.result });
        };
        reader.readAsDataURL(blob);
      }
    }
  };

  if (!currentEvent && selectedEpisodeId !== null) return html`<div className="flex-1 bg-white"></div>`;

  return html`
    <div className="flex-1 overflow-auto bg-gray-50 relative p-8">
      <div className="min-w-max mx-auto shadow-2xl">
        <svg width=${totalWidth} height=${totalHeight} viewBox=${`0 0 ${totalWidth} ${totalHeight}`} className="bg-white block">
          <defs>
            <marker id="arrowhead-blue" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#2563eb" /></marker>
            <marker id="arrowhead-red" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#dc2626" /></marker>
            <marker id="arrowhead-lightblue" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#93c5fd" /></marker>
            <marker id="arrowhead-lightred" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#fca5a5" /></marker>
          </defs>

          ${currentEvent && html`
            <foreignObject x="0" y="0" width=${totalWidth} height=${TITLE_HEIGHT * scale}>
              <div xmlns="http://www.w3.org/1999/xhtml" className="w-full h-full flex justify-center items-center border-b bg-gray-50">
                <input 
                  className="font-bold bg-transparent border-none text-center focus:ring-0 w-full"
                  style=${{ fontSize: `${TITLE_FONT_SIZE * scale}rem` }}
                  value=${currentEvent.title}
                  onChange=${(e) => setData(prev => ({
                    ...prev,
                    episodes: prev.episodes.map(ep => ({
                      ...ep,
                      events: ep.events.map(ev => ev.id === selectedEventId ? { ...ev, title: e.target.value } : ev)
                    }))
                  }))}
                />
              </div>
            </foreignObject>
          `}

          ${males.map((p, i) => {
            const y = (TITLE_HEIGHT + PADDING + i * (IMG_HEIGHT + ROW_GAP)) * scale;
            return html`
              <g key=${`male-${p.id}`}>
                ${firstPersonId === p.id && html`
                  <rect 
                    x=${(X_MALE_IMG - SELECTION_PADDING) * scale} y=${y - SELECTION_PADDING * scale}
                    width=${(MALE_IMG_WIDTH + SELECTION_PADDING * 2) * scale} height=${(IMG_HEIGHT + SELECTION_PADDING * 2) * scale}
                    fill="none" stroke="#ff00ff" strokeWidth=${SELECTION_STROKE_WIDTH * scale} rx=${SELECTION_CORNER_RADIUS * scale}
                  />
                `}
                <foreignObject x=${X_MALE_TEXT * scale} y=${y} width=${MALE_TEXT_WIDTH * scale} height=${IMG_HEIGHT * scale}>
                  <div xmlns="http://www.w3.org/1999/xhtml" className="flex flex-col text-right pr-2 h-full justify-start pt-2">
                    <input className="font-bold bg-transparent border-none text-right focus:ring-0 p-0 text-blue-900 w-full" style=${{ fontSize: `${NAME_FONT_SIZE * scale}rem` }} value=${p.name} onChange=${e => handleUpdatePerson(p.id, { name: e.target.value })} />
                    <textarea className="bg-transparent border-none text-right focus:ring-0 p-0 resize-none text-blue-800 w-full flex-1" style=${{ fontSize: `${DESC_FONT_SIZE * scale * descScale}rem` }} value=${p.description} onChange=${e => handleUpdatePerson(p.id, { description: e.target.value })} />
                  </div>
                </foreignObject>
                <foreignObject x=${X_MALE_IMG * scale} y=${y} width=${MALE_IMG_WIDTH * scale} height=${IMG_HEIGHT * scale}>
                  <div 
                    xmlns="http://www.w3.org/1999/xhtml" 
                    className="w-full h-full border-2 rounded overflow-hidden cursor-pointer flex items-center justify-center bg-gray-200 outline-none focus:ring-2 focus:ring-blue-500" 
                    tabIndex="0"
                    role="button"
                    onKeyDown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePersonClick(p.id); } }}
                    onClick=${(e) => { e.currentTarget.focus(); handlePersonClick(p.id); }} 
                    onPaste=${e => handlePaste(e, p.id)}
                  >
                    ${p.image ? html`<img src=${p.image} className="w-full h-full object-cover" />` : html`<div className="text-gray-400 text-xs">No Image</div>`}
                  </div>
                </foreignObject>
              </g>
            `;
          })}

          ${females.map((p, i) => {
            const y = (TITLE_HEIGHT + PADDING + i * (IMG_HEIGHT + ROW_GAP)) * scale;
            return html`
              <g key=${`female-${p.id}`}>
                ${firstPersonId === p.id && html`
                  <rect 
                    x=${(X_FEMALE_IMG - SELECTION_PADDING) * scale} y=${y - SELECTION_PADDING * scale}
                    width=${(FEMALE_IMG_WIDTH + SELECTION_PADDING * 2) * scale} height=${(IMG_HEIGHT + SELECTION_PADDING * 2) * scale}
                    fill="none" stroke="#ff00ff" strokeWidth=${SELECTION_STROKE_WIDTH * scale} rx=${SELECTION_CORNER_RADIUS * scale}
                  />
                `}
                <foreignObject x=${X_FEMALE_IMG * scale} y=${y} width=${FEMALE_IMG_WIDTH * scale} height=${IMG_HEIGHT * scale}>
                  <div 
                    xmlns="http://www.w3.org/1999/xhtml" 
                    className="w-full h-full border-2 rounded overflow-hidden cursor-pointer flex items-center justify-center bg-gray-200 outline-none focus:ring-2 focus:ring-red-500" 
                    tabIndex="0"
                    role="button"
                    onKeyDown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePersonClick(p.id); } }}
                    onClick=${(e) => { e.currentTarget.focus(); handlePersonClick(p.id); }} 
                    onPaste=${e => handlePaste(e, p.id)}
                  >
                    ${p.image ? html`<img src=${p.image} className="w-full h-full object-cover" />` : html`<div className="text-gray-400 text-xs">No Image</div>`}
                  </div>
                </foreignObject>
                <foreignObject x=${X_FEMALE_TEXT * scale} y=${y} width=${FEMALE_TEXT_WIDTH * scale} height=${IMG_HEIGHT * scale}>
                  <div xmlns="http://www.w3.org/1999/xhtml" className="flex flex-col text-left pl-2 h-full justify-start pt-2">
                    <input className="font-bold bg-transparent border-none text-left focus:ring-0 p-0 text-red-900 w-full" style=${{ fontSize: `${NAME_FONT_SIZE * scale}rem` }} value=${p.name} onChange=${e => handleUpdatePerson(p.id, { name: e.target.value })} />
                    <textarea className="bg-transparent border-none text-left focus:ring-0 p-0 resize-none text-red-800 w-full flex-1" style=${{ fontSize: `${DESC_FONT_SIZE * scale * descScale}rem` }} value=${p.description} onChange=${e => handleUpdatePerson(p.id, { description: e.target.value })} />
                  </div>
                </foreignObject>
              </g>
            `;
          })}

          <g className="pointer-events-none">
            ${currentEvent?.messages.map((m, i) => {
              const fromPos = personPositions[m.from];
              const toPos = personPositions[m.to];
              if (!fromPos || !toPos) return null;
              const { color, marker } = getMessageStyle(m.type, fromPos.gender);
              const { x1, y1, x2, y2 } = calculateMessageCoords(fromPos, toPos, scale, m.type);
              return html`<line key=${`msg-${i}`} x1=${x1} y1=${y1} x2=${x2} y2=${y2} stroke=${color} strokeWidth=${MESSAGE_STROKE_WIDTH * scale} markerEnd=${marker ? `url(#${marker})` : ''} />`;
            })}
          </g>

          <g className="pointer-events-none">
            ${(() => {
              if (!currentEvent) return null;
              const teams = Object.entries(currentEvent.teams).map(([idx, members]) => ({
                idx, members: members.map(id => personPositions[id]).filter(Boolean)
              })).filter(t => t.members.length > 0);

              return teams.map((team, tIdx) => {
                const avgY = team.members.reduce((sum, p) => sum + p.y, 0) / team.members.length;
                const teamX = (X_MID + MID_WIDTH * ((tIdx + 1) / (teams.length + 1))) * scale;
                return html`
                  <g key=${`team-${team.idx}`}>
                    <circle cx=${teamX} cy=${avgY} r=${TEAM_HUB_RADIUS * scale} fill=${TEAM_COLORS[team.idx]} />
                    ${team.members.map((p, mIdx) => {
                      const { x1, y1 } = calculatTeamMemberCoords(p, scale);
                      return html`<line key=${mIdx} x1=${x1} y1=${y1} x2=${teamX} y2=${avgY} stroke=${TEAM_COLORS[team.idx]} strokeWidth=${TEAM_LINE_STROKE_WIDTH * scale} strokeDasharray=${`${6 * scale} ${4 * scale}`} />`;
                    })}
                  </g>
                `;
              });
            })()}
          </g>
        </svg>
      </div>
    </div>
  `;
};
