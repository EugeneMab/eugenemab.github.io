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

const NAME_FONT_SIZE_SCALE = 1.25;
const DESC_HEIGHT_SCALE = 100;
const SMALL_FONT_SIZE_SCALE = 0.75;
const HEADER_FONT_SIZE_SCALE = 0.875;
const ICON_SIZE_14 = 14;
const ICON_SIZE_16 = 16;
const ICON_SIZE_20 = 20;

const PersonView: React.FC = () => {
  const { data, saveData } = useStore();
  const { bodyScale = 1, descriptionScale = 1 } = data;
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);

  /**
   * Adds a new person to the store with default values.
   */
  const handleAddPerson = (gender: Gender) => {
    saveData((prev) => {
      const id = prev.nextUniqueId;
      const currentCount = prev.people.filter((p) => {
        return p.gender === gender;
      }).length;
      const countLabel = currentCount + 1;

      const newPerson: Person = {
        id,
        gender,
        name: `${gender === 'male' ? 'Male' : 'Female'} ${countLabel}`,
        image: '',
        description: 'Add description...',
        ranges: '1',
      };
      return {
        ...prev,
        people: [...prev.people, newPerson],
        nextUniqueId: id + 1,
      };
    });
  };

  /**
   * Deletes a person and all their associated messages and team memberships.
   */
  const handleDeletePerson = (id: number) => {
    if (!confirm('Are you sure you want to delete this person?')) {
      return;
    }

    saveData((prev) => {
      return {
        ...prev,
        people: prev.people.filter((p) => {
          return p.id !== id;
        }),
        episodes: prev.episodes.map((ep) => {
          return {
            ...ep,
            events: ep.events.map((ev) => {
              return {
                ...ev,
                messages: ev.messages.filter((m) => {
                  return m.from !== id && m.to !== id;
                }),
                teams: Object.fromEntries(
                  Object.entries(ev.teams).map(([idx, members]) => {
                    return [
                      idx,
                      members.filter((memId) => {
                        return memId !== id;
                      }),
                    ];
                  })
                ),
              };
            }),
          };
        }),
      };
    });
  };

  /**
   * Updates person details in the store.
   */
  const handleUpdatePerson = (id: number, updates: Partial<Person>) => {
    saveData((prev) => {
      return {
        ...prev,
        people: prev.people.map((p) => {
          return p.id === id ? { ...p, ...updates } : p;
        }),
      };
    });
  };

  /**
   * Reorders a person in the list by moving them up or down.
   */
  const handleMovePerson = (id: number, direction: 'up' | 'down') => {
    saveData((prev) => {
      const person = prev.people.find((p) => {
        return p.id === id;
      });
      if (!person) {
        return prev;
      }

      const sameGenderPeople = prev.people.filter((p) => {
        return p.gender === person.gender;
      });
      const index = sameGenderPeople.findIndex((p) => {
        return p.id === id;
      });

      if (direction === 'up' && index > 0) {
        const other = sameGenderPeople[index - 1];
        const newPeople = [...prev.people];
        const idx1 = newPeople.findIndex((p) => {
          return p.id === id;
        });
        const idx2 = newPeople.findIndex((p) => {
          return p.id === other.id;
        });
        [newPeople[idx1], newPeople[idx2]] = [newPeople[idx2], newPeople[idx1]];
        return { ...prev, people: newPeople };
      } else if (direction === 'down' && index < sameGenderPeople.length - 1) {
        const other = sameGenderPeople[index + 1];
        const newPeople = [...prev.people];
        const idx1 = newPeople.findIndex((p) => {
          return p.id === id;
        });
        const idx2 = newPeople.findIndex((p) => {
          return p.id === other.id;
        });
        [newPeople[idx1], newPeople[idx2]] = [newPeople[idx2], newPeople[idx1]];
        return { ...prev, people: newPeople };
      }
      return prev;
    });
  };

  /**
   * Handles image paste into a person's image area.
   */
  const handlePaste = async (e: React.ClipboardEvent, personId: number) => {
    const items = e.clipboardData?.items;
    if (!items) {
      return;
    }

    for (const item of Array.from(items)) {
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        if (!blob) {
          continue;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = IMG_WIDTH;
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

  const males = useMemo(() => {
    return data.people.filter((p) => {
      return p.gender === 'male';
    });
  }, [data.people]);
  const females = useMemo(() => {
    return data.people.filter((p) => {
      return p.gender === 'female';
    });
  }, [data.people]);

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
    const isMale = person.gender === 'male';

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
            onClick={() => {
              return setSelectedPersonId(person.id);
            }}
            onPaste={(e) => {
              return handlePaste(e, person.id);
            }}
            tabIndex={0}
          >
            {person.image ? (
              <img src={person.image} alt={person.name} className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-500 text-center px-2"
                style={{ fontSize: `${SMALL_FONT_SIZE_SCALE * scale}rem` }}
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
              className={clsx(
                'font-bold bg-transparent border-none focus:ring-0 w-full p-0',
                isMale ? 'text-blue-900' : 'text-red-900'
              )}
              style={{ fontSize: `${NAME_FONT_SIZE_SCALE * scale}rem` }}
              value={person.name}
              onChange={(e) => {
                return handleUpdatePerson(person.id, { name: e.target.value });
              }}
            />
            <textarea
              className={clsx(
                'bg-transparent border-none focus:ring-0 w-full resize-none p-0 overflow-hidden',
                isMale ? 'text-blue-800' : 'text-red-800'
              )}
              style={{
                fontSize: `${scale * descScale}rem`,
                height: `${DESC_HEIGHT_SCALE * scale}px`,
              }}
              value={person.description}
              onChange={(e) => {
                return handleUpdatePerson(person.id, { description: e.target.value });
              }}
            />
            <div className="flex gap-2 items-center">
              {/* Range Editor */}
              <button
                className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded whitespace-nowrap"
                style={{ fontSize: `${SMALL_FONT_SIZE_SCALE * scale}rem` }}
                onClick={() => {
                  const ranges = prompt('Enter episode ranges (e.g. "2 4 7"):', person.ranges);
                  if (ranges !== null) {
                    handleUpdatePerson(person.id, { ranges });
                  }
                }}
              >
                <Hash size={ICON_SIZE_14 * scale} /> Range: {person.ranges}
              </button>

              {/* Move Controls */}
              <button
                className={clsx(
                  'p-1 rounded hover:bg-gray-200 bg-gray-100',
                  index === 0 && 'opacity-20 cursor-not-allowed'
                )}
                disabled={index === 0}
                onClick={() => {
                  return handleMovePerson(person.id, 'up');
                }}
                title="Move Up"
              >
                <ArrowUp size={ICON_SIZE_16 * scale} />
              </button>
              <button
                className={clsx(
                  'p-1 rounded hover:bg-gray-200 bg-gray-100',
                  isLast && 'opacity-20 cursor-not-allowed'
                )}
                disabled={isLast}
                onClick={() => {
                  return handleMovePerson(person.id, 'down');
                }}
                title="Move Down"
              >
                <ArrowDown size={ICON_SIZE_16 * scale} />
              </button>

              {/* Delete Button */}
              <button
                className="flex items-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded ml-auto"
                style={{ fontSize: `${SMALL_FONT_SIZE_SCALE * scale}rem` }}
                onClick={() => {
                  return handleDeletePerson(person.id);
                }}
              >
                <Trash2 size={ICON_SIZE_14 * scale} /> Delete
              </button>
            </div>
          </div>
        </foreignObject>
      </g>
    );
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50 relative">
      <div className="min-w-max">
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
              style={{ fontSize: `${HEADER_FONT_SIZE_SCALE * scale}rem` }}
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
              style={{ fontSize: `${HEADER_FONT_SIZE_SCALE * scale}rem` }}
            >
              Females
            </div>
          </foreignObject>

          {/* Male Participants List */}
          {males.map((p, i) => {
            return renderPerson(p, i, X_MALE_COL, i === males.length - 1);
          })}
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
                onClick={() => {
                  return handleAddPerson('male');
                }}
              >
                <Plus size={ICON_SIZE_20 * scale} /> Add Male
              </button>
            </div>
          </foreignObject>

          {/* Female Participants List */}
          {females.map((p, i) => {
            return renderPerson(p, i, X_FEMALE_COL, i === females.length - 1);
          })}
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
                onClick={() => {
                  return handleAddPerson('female');
                }}
              >
                <Plus size={ICON_SIZE_20 * scale} /> Add Female
              </button>
            </div>
          </foreignObject>
        </svg>
      </div>
    </div>
  );
};

export default PersonView;
