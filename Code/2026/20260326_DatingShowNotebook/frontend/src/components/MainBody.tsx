import React, { useMemo, useState, useEffect } from 'react';
import { useStore, Person, Message, MessageType } from '../store/useStore';
import { renderEventToSvgString } from '../utils/svgRenderer';
import { svgToJpeg, saveEventImage } from '../utils/imageGen';
import {
  PADDING,
  ROW_GAP,
  TITLE_HEIGHT,
  MALE_TEXT_WIDTH,
  MALE_IMG_WIDTH,
  MID_WIDTH,
  FEMALE_IMG_WIDTH,
  FEMALE_TEXT_WIDTH,
  IMG_HEIGHT,
  X_MALE_TEXT,
  X_MALE_IMG,
  X_MID,
  X_FEMALE_IMG,
  X_FEMALE_TEXT,
  TOTAL_WIDTH,
  getFilteredPeople,
  calculatePersonPositions,
  getMessageStyle,
  calculateMessageCoords,
  calculatTeamMemberCoords,
  TEAM_COLORS,
} from '../utils/layout';

const MainBody: React.FC = () => {
  const { data, selectedEpisodeId, selectedEventId, activeMode, saveData } = useStore();

  // State to track the first person clicked when creating a message (from -> to)
  const [firstPersonId, setFirstPersonId] = useState<number | null>(null);

  /**
   * Retrieves the currently selected event from the data store.
   */
  const currentEvent = useMemo(() => {
    for (const ep of data.episodes) {
      const ev = ep.events.find((e) => e.id === selectedEventId);
      if (ev) return ev;
    }
    return null;
  }, [data.episodes, selectedEventId]);

  /**
   * Calculates the 1-based index of the selected episode.
   */
  const episodeIndex = useMemo(() => {
    if (selectedEpisodeId === null) return -1;
    return data.episodes.findIndex((ep) => ep.id === selectedEpisodeId) + 1;
  }, [data.episodes, selectedEpisodeId]);

  /**
   * Filters people based on their visibility ranges for the current episode.
   */
  const filteredPeople = useMemo(() => {
    return getFilteredPeople(data, episodeIndex);
  }, [data, episodeIndex]);

  /**
   * Updates a person's details in the global store.
   */
  const handleUpdatePerson = (id: number, updates: Partial<Person>) => {
    saveData((prev) => ({
      ...prev,
      people: prev.people.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  };

  /**
   * Handles person clicks based on the current active mode (message, team, eraser).
   */
  const handlePersonClick = (personId: number) => {
    if (!selectedEventId) return;

    // Handle Relationship Message Creation
    if (activeMode === 'message' || activeMode === 'weak-message') {
      if (firstPersonId === null) {
        setFirstPersonId(personId); // First person selected
      } else {
        if (firstPersonId !== personId) {
          saveData((prev) => {
            const person1 = prev.people.find((p) => p.id === firstPersonId);
            const person2 = prev.people.find((p) => p.id === personId);

            if (!person1 || !person2) return prev;

            const isSameGender = person1.gender === person2.gender;
            const isStrong = activeMode === 'message';

            // Find the current event in the latest data
            let targetEpIdx = -1;
            let targetEvIdx = -1;
            for (let i = 0; i < prev.episodes.length; i++) {
              const j = prev.episodes[i].events.findIndex((e) => e.id === selectedEventId);
              if (j !== -1) {
                targetEpIdx = i;
                targetEvIdx = j;
                break;
              }
            }

            if (targetEpIdx === -1) return prev;
            const event = prev.episodes[targetEpIdx].events[targetEvIdx];

            // Prevent duplicate identical messages
            const existing = event.messages.some(
              (m) => m.from === firstPersonId && m.to === personId
            );
            if (existing) return prev;

            // Relationship constraints: strong messages only between opposite genders
            if (!isStrong || !isSameGender) {
              const type: MessageType = isStrong ? 'strong' : 'weak';
              const newMessage: Message = { from: firstPersonId, to: personId, type };

              return {
                ...prev,
                episodes: prev.episodes.map((ep, i) =>
                  i === targetEpIdx
                    ? {
                        ...ep,
                        events: ep.events.map((ev, j) =>
                          j === targetEvIdx
                            ? {
                                ...ev,
                                messages: [...ev.messages, newMessage],
                              }
                            : ev
                        ),
                      }
                    : ep
                ),
              };
            }
            return prev;
          });
        }
        setFirstPersonId(null);
      }
    }
    // Handle Eraser Mode: Remove all relationships and team memberships for the person
    else if (activeMode === 'eraser') {
      saveData((prev) => ({
        ...prev,
        episodes: prev.episodes.map((ep) => ({
          ...ep,
          events: ep.events.map((ev) =>
            ev.id === selectedEventId
              ? {
                  ...ev,
                  messages: ev.messages.filter((m) => m.from !== personId),
                  teams: Object.fromEntries(
                    Object.entries(ev.teams).map(([idx, members]) => [
                      idx,
                      members.filter((id) => id !== personId),
                    ])
                  ),
                }
              : ev
          ),
        })),
      }));
    }
    // Handle Team Assignment Mode
    else if (activeMode.startsWith('team-')) {
      const teamIdx = activeMode.split('-')[1];
      saveData((prev) => {
        // Find the event to check membership
        let currentEventInPrev = null;
        for (const ep of prev.episodes) {
          const ev = ep.events.find((e) => e.id === selectedEventId);
          if (ev) {
            currentEventInPrev = ev;
            break;
          }
        }
        if (!currentEventInPrev) return prev;

        const currentTeam = currentEventInPrev.teams[teamIdx] || [];
        if (currentTeam.includes(personId)) return prev;

        const newTeam = [...currentTeam, personId];

        return {
          ...prev,
          episodes: prev.episodes.map((ep) => ({
            ...ep,
            events: ep.events.map((ev) =>
              ev.id === selectedEventId
                ? {
                    ...ev,
                    teams: { ...ev.teams, [teamIdx]: newTeam },
                  }
                : ev
            ),
          })),
        };
      });
    }
  };

  /**
   * Updates the event title.
   */
  const updateTitle = (newTitle: string) => {
    saveData((prev) => ({
      ...prev,
      episodes: prev.episodes.map((ep) => ({
        ...ep,
        events: ep.events.map((ev) =>
          ev.id === selectedEventId ? { ...ev, title: newTitle } : ev
        ),
      })),
    }));
  };

  /**
   * Handles pasting images directly onto person profile areas.
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
            const size = 200; // Profile image size
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

  const males = useMemo(() => filteredPeople.filter((p) => p.gender === 'male'), [filteredPeople]);
  const females = useMemo(
    () => filteredPeople.filter((p) => p.gender === 'female'),
    [filteredPeople]
  );

  const scale = data.bodyScale || 1;
  const descScale = data.descriptionScale || 1;
  const numRows = Math.max(males.length, females.length);

  /**
   * Layout Sizing Logic
   * totalWidth and totalHeight: Derived from base constants and current participant count, then scaled.
   */
  const totalWidth = TOTAL_WIDTH * scale;
  const totalHeight = (TITLE_HEIGHT + PADDING + numRows * (IMG_HEIGHT + ROW_GAP)) * scale;

  /**
   * Position Caching
   * Pre-calculates center points for all visible persons to anchor relationship lines and team connectors.
   */
  const personPositions = useMemo(() => {
    return calculatePersonPositions(males, females, scale);
  }, [males, females, scale]);

  const eventIndex = useMemo(() => {
    if (selectedEpisodeId === null || selectedEventId === null) return -1;
    const ep = data.episodes.find((e) => e.id === selectedEpisodeId);
    if (!ep) return -1;
    return ep.events.findIndex((e) => e.id === selectedEventId) + 1;
  }, [data.episodes, selectedEpisodeId, selectedEventId]);

  /**
   * Side effect to auto-save the event as a JPG image after changes.
   */
  useEffect(() => {
    if (episodeIndex <= 0 || eventIndex <= 0 || !currentEvent) return;

    const timer = setTimeout(async () => {
      try {
        const svgString = renderEventToSvgString(currentEvent, data, episodeIndex);
        const jpegBase64 = await svgToJpeg(svgString);
        const epIdx = String(episodeIndex).padStart(2, '0');
        const evIdx = String(eventIndex).padStart(2, '0');
        await saveEventImage(`${epIdx}_${evIdx}.jpg`, jpegBase64);
      } catch (e) {
        console.error('Failed to debounced save image:', e);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [data, episodeIndex, eventIndex, currentEvent]);

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
          <marker
            id="arrowhead-blue"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#2563eb" />
          </marker>
          <marker
            id="arrowhead-red"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#dc2626" />
          </marker>
          <marker
            id="arrowhead-lightblue"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#93c5fd" />
          </marker>
          <marker
            id="arrowhead-lightred"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#fca5a5" />
          </marker>
        </defs>

        {/* Title */}
        {currentEvent && (
          <foreignObject x={0} y={0} width={totalWidth} height={TITLE_HEIGHT * scale}>
            <div
              xmlns="http://www.w3.org/1999/xhtml"
              className="w-full h-full flex justify-center items-center border-b border-gray-100 bg-gray-50"
            >
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
          const isSelected = firstPersonId === p.id;
          return (
            <g key={`male-${p.id}`}>
              {isSelected && (
                <rect
                  x={(X_MALE_IMG - 6) * scale}
                  y={y - 6 * scale}
                  width={(MALE_IMG_WIDTH + 12) * scale}
                  height={(IMG_HEIGHT + 12) * scale}
                  fill="none"
                  stroke="#ff00ff"
                  strokeWidth={4 * scale}
                  rx={8 * scale}
                />
              )}
              <foreignObject
                x={X_MALE_TEXT * scale}
                y={y}
                width={MALE_TEXT_WIDTH * scale}
                height={IMG_HEIGHT * scale}
              >
                <div
                  xmlns="http://www.w3.org/1999/xhtml"
                  className="flex flex-col text-right pr-2 h-full justify-start pt-2 w-full"
                >
                  <input
                    className="font-bold bg-transparent border-none text-right focus:ring-0 p-0 text-blue-900 w-full"
                    style={{ fontSize: `${1.8 * scale}rem` }}
                    value={p.name}
                    onChange={(e) => handleUpdatePerson(p.id, { name: e.target.value })}
                  />
                  <textarea
                    className="overflow-hidden bg-transparent border-none text-right focus:ring-0 p-0 resize-none text-blue-800 w-full"
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
                  className="w-full h-full border-2 rounded overflow-hidden cursor-pointer flex items-center justify-center bg-gray-200"
                  onClick={() => handlePersonClick(p.id)}
                  onPaste={(e) => handlePaste(e, p.id)}
                  tabIndex={0}
                >
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div
                      className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-500 px-2 text-center"
                      style={{ fontSize: `${0.75 * scale}rem` }}
                    >
                      No Image (Paste Here)
                    </div>
                  )}
                </div>
              </foreignObject>
            </g>
          );
        })}

        {/* Females */}
        {females.map((p, i) => {
          const y = (TITLE_HEIGHT + PADDING + i * (IMG_HEIGHT + ROW_GAP)) * scale;
          const isSelected = firstPersonId === p.id;
          return (
            <g key={`female-${p.id}`}>
              {isSelected && (
                <rect
                  x={(X_FEMALE_IMG - 6) * scale}
                  y={y - 6 * scale}
                  width={(FEMALE_IMG_WIDTH + 12) * scale}
                  height={(IMG_HEIGHT + 12) * scale}
                  fill="none"
                  stroke="#ff00ff"
                  strokeWidth={4 * scale}
                  rx={8 * scale}
                />
              )}
              <foreignObject
                x={X_FEMALE_IMG * scale}
                y={y}
                width={FEMALE_IMG_WIDTH * scale}
                height={IMG_HEIGHT * scale}
              >
                <div
                  xmlns="http://www.w3.org/1999/xhtml"
                  className="w-full h-full border-2 rounded overflow-hidden cursor-pointer flex items-center justify-center bg-gray-200"
                  onClick={() => handlePersonClick(p.id)}
                  onPaste={(e) => handlePaste(e, p.id)}
                  tabIndex={0}
                >
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div
                      className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-500 px-2 text-center"
                      style={{ fontSize: `${0.75 * scale}rem` }}
                    >
                      No Image (Paste Here)
                    </div>
                  )}
                </div>
              </foreignObject>
              <foreignObject
                x={X_FEMALE_TEXT * scale}
                y={y}
                width={FEMALE_TEXT_WIDTH * scale}
                height={IMG_HEIGHT * scale}
              >
                <div
                  xmlns="http://www.w3.org/1999/xhtml"
                  className="flex flex-col text-left pl-2 h-full justify-start pt-2 w-full"
                >
                  <input
                    className="font-bold bg-transparent border-none text-left focus:ring-0 p-0 text-red-900 w-full"
                    style={{ fontSize: `${1.8 * scale}rem` }}
                    value={p.name}
                    onChange={(e) => handleUpdatePerson(p.id, { name: e.target.value })}
                  />
                  <textarea
                    className="overflow-hidden bg-transparent border-none text-left focus:ring-0 p-0 resize-none text-red-800 w-full"
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

        {/* Messages Rendering: Relationship lines between participants */}
        <g className="pointer-events-none">
          {currentEvent?.messages.map((m, i) => {
            const fromPos = personPositions[m.from];
            const toPos = personPositions[m.to];
            if (!fromPos || !toPos) return null;

            const { color, marker } = getMessageStyle(m.type, fromPos.gender);
            const { x1, y1, x2, y2 } = calculateMessageCoords(fromPos, toPos, scale);

            /**
             * Special Case: Intra-gender messages (Same gender)
             * Draws a two-segment line via the center of the MID_WIDTH area to avoid overlapping profile images.
             */
            if (fromPos.gender === toPos.gender) {
              const centerX = (X_MID + MID_WIDTH / 2) * scale;

              return (
                <g key={`msg-${i}`}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={centerX}
                    y2={y2}
                    stroke={color}
                    strokeWidth={2 * scale}
                  />
                  <line
                    x1={centerX}
                    y1={y2}
                    x2={x2}
                    y2={y2}
                    stroke={color}
                    strokeWidth={2 * scale}
                    markerEnd={`url(#${marker})`}
                  />
                </g>
              );
            }

            // Normal Case: Cross-gender messages (Straight line)
            return (
              <line
                key={`msg-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={color}
                strokeWidth={2 * scale}
                markerEnd={`url(#${marker})`}
              />
            );
          })}
        </g>

        {/* Teams Rendering: Collective hubs for group memberships */}
        <g className="pointer-events-none">
          {(() => {
            if (!currentEvent) return null;

            // Identify teams that actually have members visible in this episode
            const concreteTeams = Object.entries(currentEvent.teams)
              .map(([originalIndex, members]) => {
                const validMembers = members.map((id) => personPositions[id]).filter(Boolean);
                return validMembers.length > 0 ? { originalIndex, validMembers } : null;
              })
              .filter(Boolean);

            return concreteTeams.map(({ originalIndex, validMembers }, concreteIndex) => {
              /**
               * Coordinate Calculation:
               * teamY: Calculated as the average vertical center of all its members.
               * teamX: Distributed evenly within the MID_WIDTH column based on the active team count.
               */
              const avgY = validMembers.reduce((sum, p) => sum + p.y, 0) / validMembers.length;
              const teamX =
                (X_MID + MID_WIDTH * ((Number(concreteIndex) + 1) / (concreteTeams.length + 1))) *
                scale;
              const teamY = avgY;

              return (
                <g key={`team-${originalIndex}`}>
                  {/* The central hub point for the team */}
                  <circle
                    cx={teamX}
                    cy={teamY}
                    r={6 * scale}
                    fill={TEAM_COLORS[Number(originalIndex)]}
                  />
                  {/* Dotted lines connecting each member to the hub */}
                  {validMembers.map((p, i) => (
                    <line
                      key={`team-${originalIndex}-mem-${i}`}
                      x1={calculatTeamMemberCoords(p, scale).x1}
                      y1={calculatTeamMemberCoords(p, scale).y1}
                      x2={teamX}
                      y2={teamY}
                      stroke={TEAM_COLORS[Number(originalIndex)]}
                      strokeWidth={3 * scale}
                      strokeDasharray={`${6 * scale} ${4 * scale}`}
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
