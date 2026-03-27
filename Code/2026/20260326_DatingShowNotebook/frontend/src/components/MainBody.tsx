import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useStore, Person, Message, MessageType } from '../store/useStore';
import MalePerson from './MalePerson';
import FemalePerson from './FemalePerson';
import { clsx } from 'clsx';

const MainBody: React.FC = () => {
  const { 
    data, selectedEpisodeId, selectedEventId, activeMode, 
    bodyScale, descriptionScale, saveData 
  } = useStore();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const [positions, setPositions] = useState<{ [key: number]: { x: number, y: number, gender: string } }>({});
  const [firstPersonId, setFirstPersonId] = useState<number | null>(null);

  const teamColors = ['#f97316', '#06b6d4', '#a855f7', '#84cc16', '#eab308'];

  const currentEvent = useMemo(() => {
    for (const ep of data.episodes) {
      const ev = ep.events.find(e => e.id === selectedEventId);
      if (ev) return ev;
    }
    return null;
  }, [data.episodes, selectedEventId]);

  const filteredPeople = useMemo(() => {
    if (selectedEpisodeId === null) return data.people;
    return data.people.filter(p => {
      const ranges = p.ranges.split(/\s+/).map(Number).filter(n => !isNaN(n));
      if (ranges.length === 0) return true;
      for (let i = 0; i < ranges.length; i += 2) {
        const start = ranges[i];
        const end = ranges[i + 1] || Infinity;
        if (selectedEpisodeId >= start && selectedEpisodeId <= end) return true;
      }
      return false;
    });
  }, [data.people, selectedEpisodeId]);

  const updatePositions = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newPositions: typeof positions = {};
    
    filteredPeople.forEach(p => {
      const el = imageRefs.current[p.id];
      if (el) {
        const rect = el.getBoundingClientRect();
        // Calculate point relative to container and account for zoom
        const x = (p.gender === 'male' ? rect.right : rect.left) - containerRect.left;
        const y = rect.top - containerRect.top * 2 + rect.height / 2;
        
        newPositions[p.id] = { x, y, gender: p.gender };
      }
    });
    setPositions(newPositions);
  };

  useEffect(() => {
    const timer = setTimeout(updatePositions, 100);
    window.addEventListener('resize', updatePositions);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePositions);
    };
  }, [filteredPeople, bodyScale]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new MutationObserver(updatePositions);
    observer.observe(containerRef.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const handlePersonClick = (personId: number) => {
    if (!currentEvent) return;

    if (activeMode === 'message' || activeMode === 'weak-message') {
      if (firstPersonId === null) {
        setFirstPersonId(personId);
      } else {
        if (firstPersonId !== personId) {
          const type: MessageType = activeMode === 'message' ? 'strong' : 'weak';
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
        setFirstPersonId(null);
      }
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

  const males = filteredPeople.filter(p => p.gender === 'male');
  const females = filteredPeople.filter(p => p.gender === 'female');

  return (
    <div className="h-full flex flex-col overflow-hidden" ref={containerRef}>
      {currentEvent && (
        <div className="p-4 flex justify-center border-b border-gray-100 bg-gray-50 shrink-0">
          <input
            className="text-2xl font-bold bg-transparent border-none text-center focus:ring-0"
            value={currentEvent.title}
            onChange={(e) => updateTitle(e.target.value)}
          />
        </div>
      )}
      
      <div className="flex-1 relative" style={{ transform: `scale(${bodyScale})`, transformOrigin: 'top center' }}>
        <svg className="absolute inset-0 pointer-events-none z-0 w-full h-full">
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

          {currentEvent?.messages.map((m, i) => {
            const from = positions[m.from];
            const to = positions[m.to];
            if (!from || !to) return null;

            const isMale = from.gender === 'male';
            const offset = isMale ? 10 : -10;
            
            let color = '';
            let marker = '';
            if (m.type === 'strong') {
              color = isMale ? '#2563eb' : '#dc2626';
              marker = isMale ? 'arrowhead-blue' : 'arrowhead-red';
            } else {
              color = isMale ? '#93c5fd' : '#fca5a5';
              marker = isMale ? 'arrowhead-lightblue' : 'arrowhead-lightred';
            }

            return (
              <line
                key={`msg-${i}`}
                x1={from.x} y1={from.y + offset}
                x2={to.x} y2={to.y + offset}
                stroke={color}
                strokeWidth="2"
                markerEnd={`url(#${marker})`}
              />
            );
          })}

          {currentEvent && Object.entries(currentEvent.teams).map(([idx, members]) => {
            if (members.length === 0) return null;
            const validMembers = members.map(id => positions[id]).filter(Boolean);
            if (validMembers.length === 0) return null;

            const avgY = validMembers.reduce((sum, p) => sum + p.y, 0) / validMembers.length;
            
            // X coordinate between male right and female left
            let maxMaleX = -Infinity;
            let minFemaleX = Infinity;
            
            validMembers.forEach(p => {
              if (p.gender === 'male') {
                maxMaleX = Math.max(maxMaleX, p.x);
              } else {
                minFemaleX = Math.min(minFemaleX, p.x);
              }
            });
            
            // If one side is missing
            if (!(maxMaleX !== -Infinity && minFemaleX !== Infinity)) return null; 

            const teamX = maxMaleX + (minFemaleX - maxMaleX) * ((Number(idx) + 1) / (5 + 1));
              
            const teamY = avgY;

            return (
              <g key={`team-${idx}`}>
                <circle cx={teamX} cy={teamY} r="6" fill={teamColors[Number(idx)]} />
                {validMembers.map((p, i) => (
                  <line
                    key={`team-${idx}-mem-${i}`}
                    x1={p.x} y1={p.y}
                    x2={teamX} y2={teamY}
                    stroke={teamColors[Number(idx)]}
                    strokeWidth="1.5"
                    strokeDasharray="4"
                  />
                ))}
              </g>
            );
          })}
        </svg>

        <div className="flex justify-between px-8 py-4 z-10 relative">
          <div className="flex flex-col gap-12 w-1/3">
            {males.map(person => (
              <MalePerson
                key={person.id}
                person={person}
                descriptionScale={descriptionScale}
                isFirstSelected={firstPersonId === person.id}
                onClick={handlePersonClick}
                innerRef={el => imageRefs.current[person.id] = el}
              />
            ))}
          </div>

          <div className="flex flex-col gap-12 w-1/3">
            {females.map(person => (
              <FemalePerson
                key={person.id}
                person={person}
                descriptionScale={descriptionScale}
                isFirstSelected={firstPersonId === person.id}
                onClick={handlePersonClick}
                innerRef={el => imageRefs.current[person.id] = el}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainBody;
