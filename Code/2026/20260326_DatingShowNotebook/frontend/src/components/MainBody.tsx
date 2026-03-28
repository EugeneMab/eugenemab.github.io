import React, { useRef, useMemo, useState } from 'react';
import { useStore, Person, Message, MessageType, Gender } from '../store/useStore';
import { clsx } from 'clsx';

const PADDING = 20;
const ROW_GAP = 40;
const TITLE_HEIGHT = 60;
const MALE_TEXT_WIDTH = 300;
const MALE_IMG_WIDTH = 200;
const MID_WIDTH = 400;
const FEMALE_IMG_WIDTH = 200;
const FEMALE_TEXT_WIDTH = 300;
const IMG_HEIGHT = 200;

const X_MALE_TEXT = PADDING;
const X_MALE_IMG = X_MALE_TEXT + MALE_TEXT_WIDTH + PADDING;
const X_MID = X_MALE_IMG + MALE_IMG_WIDTH + PADDING;
const X_FEMALE_IMG = X_MID + MID_WIDTH + PADDING;
const X_FEMALE_TEXT = X_FEMALE_IMG + FEMALE_IMG_WIDTH + PADDING;
const TOTAL_WIDTH = X_FEMALE_TEXT + FEMALE_TEXT_WIDTH + PADDING;

const MainBody: React.FC = () => {
  const { 
    data, selectedEpisodeId, selectedEventId, activeMode, 
    saveData 
  } = useStore();
  
  const [firstPersonId, setFirstPersonId] = useState<number | null>(null);

  const teamColors = ['#f97316', '#06b6d4', '#a855f7', '#84cc16', '#eab308'];

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

  const filteredPeople = useMemo(() => {
    if (episodeIndex <= 0) return data.people;
    return data.people.filter(p => {
      const ranges = p.ranges.split(/\s+/).map(Number).filter(n => !isNaN(n));
      if (ranges.length === 0) return true;
      for (let i = 0; i < ranges.length; i += 2) {
        const start = ranges[i];
        const end = ranges[i + 1] || Infinity;
        if (episodeIndex >= start && episodeIndex <= end) return true;
      }
      return false;
    });
  }, [data.people, episodeIndex]);

  const handleUpdatePerson = (id: number, updates: Partial<Person>) => {
    saveData({
      ...data,
      people: data.people.map(p => p.id === id ? { ...p, ...updates } : p)
    });
  };

  const handlePersonClick = (personId: number) => {
    if (!currentEvent) return;

    if (activeMode === 'message' || activeMode === 'weak-message') {
      if (firstPersonId === null) {
        setFirstPersonId(personId);
      } else {
        if (firstPersonId !== personId) {
          const person1 = data.people.find(p => p.id === firstPersonId);
          const person2 = data.people.find(p => p.id === personId);
          
          if (person1 && person2) {
            const isSameGender = person1.gender === person2.gender;
            const isStrong = activeMode === 'message';
            
            if (!isStrong || !isSameGender) {
              const type: MessageType = isStrong ? 'strong' : 'weak';
              const newMessage: Message = { from: firstPersonId, to: personId, type };
              
              saveData({
                ...data,
                episodes: data.episodes.map(ep => ({
                  ...ep,
                  events: ep.events.map(ev => ev.id === selectedEventId ? {
                    ...ev,
                    messages: [...ev.messages, newMessage]
                  } : ev)
                }))
              });
            }
          }
        }
        setFirstPersonId(null);
      }
    } else if (activeMode === 'eraser') {
      saveData({
        ...data,
        episodes: data.episodes.map(ep => ({
          ...ep,
          events: ep.events.map(ev => ev.id === selectedEventId ? {
            ...ev,
            messages: ev.messages.filter(m => m.from !== personId && m.to !== personId),
            teams: Object.fromEntries(
              Object.entries(ev.teams).map(([idx, members]) => [
                idx,
                members.filter(id => id !== personId)
              ])
            )
          } : ev)
        }))
      });
    } else if (activeMode.startsWith('team-')) {
      const teamIdx = activeMode.split('-')[1];
      const currentTeam = currentEvent.teams[teamIdx] || [];
      const isMember = currentTeam.includes(personId);
      
      const newTeam = isMember 
        ? currentTeam.filter(id => id !== personId)
        : [...currentTeam, personId];

      saveData({
        ...data,
        episodes: data.episodes.map(ep => ({
          ...ep,
          events: ep.events.map(ev => ev.id === selectedEventId ? {
            ...ev,
            teams: { ...ev.teams, [teamIdx]: newTeam }
          } : ev)
        }))
      });
    }
  };

  const updateTitle = (newTitle: string) => {
    saveData({
      ...data,
      episodes: data.episodes.map(ep => ({
        ...ep,
        events: ep.events.map(ev => ev.id === selectedEventId ? { ...ev, title: newTitle } : ev)
      }))
    });
  };

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

  const males = useMemo(() => filteredPeople.filter(p => p.gender === 'male'), [filteredPeople]);
  const females = useMemo(() => filteredPeople.filter(p => p.gender === 'female'), [filteredPeople]);

  const scale = data.bodyScale || 1;
  const descScale = data.descriptionScale || 1;
  const numRows = Math.max(males.length, females.length);
  const totalWidth = TOTAL_WIDTH * scale;
  const totalHeight = (TITLE_HEIGHT + PADDING + numRows * (IMG_HEIGHT + ROW_GAP)) * scale;

  const personPositions = useMemo(() => {
    const pos: { [id: number]: { x: number, y: number, gender: Gender } } = {};
    males.forEach((p, i) => {
      const y = (TITLE_HEIGHT + PADDING + i * (IMG_HEIGHT + ROW_GAP) + IMG_HEIGHT / 2) * scale;
      const x = (X_MALE_IMG + MALE_IMG_WIDTH) * scale;
      pos[p.id] = { x, y, gender: 'male' };
    });
    females.forEach((p, i) => {
      const y = (TITLE_HEIGHT + PADDING + i * (IMG_HEIGHT + ROW_GAP) + IMG_HEIGHT / 2) * scale;
      const x = X_FEMALE_IMG * scale;
      pos[p.id] = { x, y, gender: 'female' };
    });
    return pos;
  }, [males, females, scale]);

  if (selectedEpisodeId !== null && !currentEvent) {
    return <div className="flex-1 bg-white" />;
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50 relative">
      <svg 
        width={totalWidth} 
        height={totalHeight} 
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="bg-white shadow-lg block"
        style={{ minWidth: totalWidth, minHeight: totalHeight }}
      >
        <defs>
          <marker id="arrowhead-blue" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#2563eb" />
          </marker>
          <marker id="arrowhead-red" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#dc2626" />
          </marker>
          <marker id="arrowhead-lightblue" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#93c5fd" />
          </marker>
          <marker id="arrowhead-lightred" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#fca5a5" />
          </marker>
        </defs>

        {/* Title */}
        {currentEvent && (
          <foreignObject x={0} y={0} width={totalWidth} height={TITLE_HEIGHT * scale}>
            <div xmlns="http://www.w3.org/1999/xhtml" className="w-full h-full flex justify-center items-center border-b border-gray-100 bg-gray-50">
              <input
                className="font-bold bg-transparent border-none text-center focus:ring-0 w-full"
                style={{ fontSize: `${2 * scale}rem` }}
                value={currentEvent.title}
                onChange={(e) => updateTitle(e.target.value)}
              />
            </div>
          </foreignObject>
        )}

        {/* Males */}
        {males.map((p, i) => {
          const y = (TITLE_HEIGHT + PADDING + i * (IMG_HEIGHT + ROW_GAP)) * scale;
          return (
            <g key={`male-${p.id}`}>
              <foreignObject 
                x={X_MALE_TEXT * scale} 
                y={y} 
                width={MALE_TEXT_WIDTH * scale} 
                height={IMG_HEIGHT * scale}
              >
                <div xmlns="http://www.w3.org/1999/xhtml" className="flex flex-col text-right pr-2 h-full justify-start pt-2 w-full">
                  <input
                    className="font-bold bg-transparent border-none text-right focus:ring-0 p-0 text-blue-900 w-full"
                    style={{ fontSize: `${1.125 * scale}rem` }}
                    value={p.name}
                    onChange={(e) => handleUpdatePerson(p.id, { name: e.target.value })}
                  />
                  <textarea
                    className="italic overflow-hidden bg-transparent border-none text-right focus:ring-0 p-0 resize-none text-blue-800 w-full"
                    style={{ fontSize: `${0.875 * scale * descScale}rem`, height: 'auto' }}
                    value={p.description}
                    rows={Math.max(2, p.description.split('\n').length)}
                    onChange={(e) => handleUpdatePerson(p.id, { description: e.target.value })}
                  />
                </div>
              </foreignObject>
              <foreignObject 
                x={X_MALE_IMG * scale} 
                y={y} 
                width={MALE_IMG_WIDTH * scale} 
                height={IMG_HEIGHT * scale}
              >
                <div 
                  xmlns="http://www.w3.org/1999/xhtml"
                  className={clsx(
                    "w-full h-full border-2 rounded overflow-hidden cursor-pointer transition-transform flex items-center justify-center bg-gray-200",
                    firstPersonId === p.id && "ring-4 ring-blue-500"
                  )}
                  onClick={() => handlePersonClick(p.id)}
                  onPaste={(e) => handlePaste(e, p.id)}
                  tabIndex={0}
                >
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-500 px-2 text-center" style={{ fontSize: `${0.75 * scale}rem` }}>No Image (Paste Here)</div>
                  )}
                </div>
              </foreignObject>
            </g>
          );
        })}

        {/* Females */}
        {females.map((p, i) => {
          const y = (TITLE_HEIGHT + PADDING + i * (IMG_HEIGHT + ROW_GAP)) * scale;
          return (
            <g key={`female-${p.id}`}>
              <foreignObject 
                x={X_FEMALE_IMG * scale} 
                y={y} 
                width={FEMALE_IMG_WIDTH * scale} 
                height={IMG_HEIGHT * scale}
              >
                <div 
                  xmlns="http://www.w3.org/1999/xhtml"
                  className={clsx(
                    "w-full h-full border-2 rounded overflow-hidden cursor-pointer transition-transform flex items-center justify-center bg-gray-200",
                    firstPersonId === p.id && "ring-4 ring-blue-500"
                  )}
                  onClick={() => handlePersonClick(p.id)}
                  onPaste={(e) => handlePaste(e, p.id)}
                  tabIndex={0}
                >
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-500 px-2 text-center" style={{ fontSize: `${0.75 * scale}rem` }}>No Image (Paste Here)</div>
                  )}
                </div>
              </foreignObject>
              <foreignObject 
                x={X_FEMALE_TEXT * scale} 
                y={y} 
                width={FEMALE_TEXT_WIDTH * scale} 
                height={IMG_HEIGHT * scale}
              >
                <div xmlns="http://www.w3.org/1999/xhtml" className="flex flex-col text-left pl-2 h-full justify-start pt-2 w-full">
                  <input
                    className="font-bold bg-transparent border-none text-left focus:ring-0 p-0 text-red-900 w-full"
                    style={{ fontSize: `${1.125 * scale}rem` }}
                    value={p.name}
                    onChange={(e) => handleUpdatePerson(p.id, { name: e.target.value })}
                  />
                  <textarea
                    className="italic overflow-hidden bg-transparent border-none text-left focus:ring-0 p-0 resize-none text-red-800 w-full"
                    style={{ fontSize: `${0.875 * scale * descScale}rem`, height: 'auto' }}
                    value={p.description}
                    rows={Math.max(2, p.description.split('\n').length)}
                    onChange={(e) => handleUpdatePerson(p.id, { description: e.target.value })}
                  />
                </div>
              </foreignObject>
            </g>
          );
        })}

        {/* Messages */}
        <g className="pointer-events-none">
          {currentEvent?.messages.map((m, i) => {
            const from = personPositions[m.from];
            const to = personPositions[m.to];
            if (!from || !to) return null;

            const isMale = from.gender === 'male';
            const offset = (isMale ? 10 : -10) * scale;
            
            let color = '';
            let marker = '';
            if (m.type === 'strong') {
              color = isMale ? '#2563eb' : '#dc2626';
              marker = isMale ? 'arrowhead-blue' : 'arrowhead-red';
            } else {
              color = isMale ? '#93c5fd' : '#fca5a5';
              marker = isMale ? 'arrowhead-lightblue' : 'arrowhead-lightred';
            }

            if (from.gender === to.gender) {
              const centerX = (X_MID + MID_WIDTH / 2) * scale;
              const y1 = from.y + offset;
              const y2 = to.y + offset;

              return (
                <g key={`msg-${i}`}>
                  <line x1={from.x} y1={y1} x2={centerX} y2={y1} stroke={color} strokeWidth={2 * scale} />
                  <line x1={centerX} y1={y1} x2={centerX} y2={y2} stroke={color} strokeWidth={2 * scale} />
                  <line x1={centerX} y1={y2} x2={to.x} y2={y2} stroke={color} strokeWidth={2 * scale} markerEnd={`url(#${marker})`} />
                </g>
              );
            }

            return (
              <line
                key={`msg-${i}`}
                x1={from.x} y1={from.y + offset}
                x2={to.x} y2={to.y + offset}
                stroke={color}
                strokeWidth={2 * scale}
                markerEnd={`url(#${marker})`}
              />
            );
          })}
        </g>

        {/* Teams */}
        <g className="pointer-events-none">
          {(() => {
            if (!currentEvent) return null;
            
            return Object.entries(currentEvent.teams).map(([idx, members]) => {
              if (members.length === 0) return null;
              const validMembers = members.map(id => personPositions[id]).filter(Boolean);
              if (validMembers.length === 0) return null;

              const avgY = validMembers.reduce((sum, p) => sum + p.y, 0) / validMembers.length;
              const teamX = (X_MID + MID_WIDTH * ((Number(idx) + 1) / (5 + 1))) * scale;
              const teamY = avgY;

              return (
                <g key={`team-${idx}`}>
                  <circle cx={teamX} cy={teamY} r={6 * scale} fill={teamColors[Number(idx)]} />
                  {validMembers.map((p, i) => (
                    <line
                      key={`team-${idx}-mem-${i}`}
                      x1={p.x} y1={p.y}
                      x2={teamX} y2={teamY}
                      stroke={teamColors[Number(idx)]}
                      strokeWidth={1.5 * scale}
                      strokeDasharray={4 * scale}
                    />
                  ))}
                </g>
              );
            });
          })()}
        </g>
      </svg>
    </div>
  );
};

export default MainBody;
