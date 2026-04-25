import { Event, AppData } from '../store/useStore';
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
  getFilteredPeople,
  calculatePersonPositions,
  getMessageStyle,
  calculateMessageCoords,
  calculatTeamMemberCoords,
  TEAM_COLORS,
  TITLE_FONT_SIZE,
  NAME_FONT_SIZE,
  DESC_FONT_SIZE,
  SMALL_FONT_SIZE,
  MESSAGE_STROKE_WIDTH,
  TEAM_HUB_RADIUS,
  TEAM_LINE_STROKE_WIDTH,
} from './layout';

const EXPORT_SCALE = 1;
const TITLE_Y_DIVIDER = 2;
const IMG_RX = 4;
const DASH_ARRAY_6 = 6;
const DASH_ARRAY_4 = 4;

const MARKER_WIDTH = 10;
const MARKER_HEIGHT = 7;
const MARKER_REFX = 9;
const MARKER_REFY = 3.5;
const POLYGON_POINTS = '0 0, 10 3.5, 0 7';

const COLOR_WHITE = 'white';
const COLOR_TITLE_BG = '#f9fafb';
const COLOR_TITLE_LINE = '#f3f4f6';
const COLOR_MALE_NAME = '#1e3a8a';
const COLOR_MALE_DESC = '#1e40af';
const COLOR_FEMALE_NAME = '#7f1d1d';
const COLOR_FEMALE_DESC = '#991b1b';
const COLOR_IMG_BG = '#e5e7eb';
const COLOR_IMG_STROKE = '#d1d5db';
const COLOR_NO_IMG_TEXT = '#6b7280';

const TEXT_PADDING_8 = 8;
const MARGIN_BOTTOM_4 = 4;

export function renderEventToSvgString(event: Event, data: AppData, episodeIndex: number): string {
  const filteredPeople = getFilteredPeople(data, episodeIndex);
  const males = filteredPeople.filter((p) => {
    return p.gender === 'male';
  });
  const females = filteredPeople.filter((p) => {
    return p.gender === 'female';
  });

  const scale = EXPORT_SCALE;
  const descScale = data.descriptionScale || 1;
  const numRows = Math.max(males.length, females.length);

  /**
   * Layout Dimensions:
   * Dynamically calculated based on participant count and user-defined scaling.
   * Total height ensures all participant rows fit on the canvas.
   */
  const totalWidth = (X_FEMALE_TEXT + FEMALE_TEXT_WIDTH + PADDING) * scale;
  const totalHeight = (TITLE_HEIGHT + PADDING + numRows * (IMG_HEIGHT + ROW_GAP)) * scale;

  const personPositions = calculatePersonPositions(males, females, scale);

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" style="background: ${COLOR_WHITE};">
      <defs>
        <marker id="arrowhead-blue" markerWidth="${MARKER_WIDTH}" markerHeight="${MARKER_HEIGHT}" refX="${MARKER_REFX}" refY="${MARKER_REFY}" orient="auto">
          <polygon points="${POLYGON_POINTS}" fill="#2563eb" />
        </marker>
        <marker id="arrowhead-red" markerWidth="${MARKER_WIDTH}" markerHeight="${MARKER_HEIGHT}" refX="${MARKER_REFX}" refY="${MARKER_REFY}" orient="auto">
          <polygon points="${POLYGON_POINTS}" fill="#dc2626" />
        </marker>
        <marker id="arrowhead-lightblue" markerWidth="${MARKER_WIDTH}" markerHeight="${MARKER_HEIGHT}" refX="${MARKER_REFX}" refY="${MARKER_REFY}" orient="auto">
          <polygon points="${POLYGON_POINTS}" fill="#93c5fd" />
        </marker>
        <marker id="arrowhead-lightred" markerWidth="${MARKER_WIDTH}" markerHeight="${MARKER_HEIGHT}" refX="${MARKER_REFX}" refY="${MARKER_REFY}" orient="auto">
          <polygon points="${POLYGON_POINTS}" fill="#fca5a5" />
        </marker>
      </defs>

      <rect width="100%" height="100%" fill="${COLOR_WHITE}" />

      <!-- Title Section -->
      <rect x="0" y="0" width="${totalWidth}" height="${TITLE_HEIGHT * scale}" fill="${COLOR_TITLE_BG}" />
      <line x1="0" y1="${TITLE_HEIGHT * scale}" x2="${totalWidth}" y2="${TITLE_HEIGHT * scale}" stroke="${COLOR_TITLE_LINE}" stroke-width="1" />
      <text 
        x="${totalWidth / TITLE_Y_DIVIDER}" 
        y="${(TITLE_HEIGHT * scale) / TITLE_Y_DIVIDER}" 
        text-anchor="middle" 
        dominant-baseline="middle" 
        style="font-family: sans-serif; font-weight: bold; font-size: ${TITLE_FONT_SIZE * scale}rem;"
      >${event.title}</text>

      <!-- Male Participants -->
      ${males
        .map((p, i) => {
          const y = (TITLE_HEIGHT + PADDING + i * (IMG_HEIGHT + ROW_GAP)) * scale;
          const descFontSize = DESC_FONT_SIZE * scale * descScale;

          return `
          <g>
            <!-- Name & Description (HTML-like wrapping) -->
            <foreignObject
              x="${X_MALE_TEXT * scale}"
              y="${y}"
              width="${MALE_TEXT_WIDTH * scale}"
              height="${IMG_HEIGHT * scale}"
            >
              <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; text-align: right; padding-right: ${TEXT_PADDING_8}px; height: 100%; justify-content: flex-start; padding-top: ${TEXT_PADDING_8}px; width: 100%; font-family: sans-serif;">
                <div style="font-weight: bold; font-size: ${NAME_FONT_SIZE * scale}rem; color: ${COLOR_MALE_NAME}; margin-bottom: ${MARGIN_BOTTOM_4}px;">${p.name}</div>
                <div style="font-size: ${descFontSize}rem; color: ${COLOR_MALE_DESC}; white-space: pre-wrap; word-wrap: break-word;">${p.description}</div>
              </div>
            </foreignObject>

            <!-- Image Container -->
            <rect 
              x="${X_MALE_IMG * scale}" 
              y="${y}" 
              width="${MALE_IMG_WIDTH * scale}" 
              height="${IMG_HEIGHT * scale}" 
              fill="${COLOR_IMG_BG}" 
              rx="${IMG_RX * scale}"
            />
            ${
              p.image
                ? `
              <image 
                x="${X_MALE_IMG * scale}" 
                y="${y}" 
                width="${MALE_IMG_WIDTH * scale}" 
                height="${IMG_HEIGHT * scale}" 
                href="${p.image}" 
                preserveAspectRatio="xMidYMid slice"
              />`
                : `
              <text 
                x="${(X_MALE_IMG + MALE_IMG_WIDTH / TITLE_Y_DIVIDER) * scale}" 
                y="${y + (IMG_HEIGHT / TITLE_Y_DIVIDER) * scale}" 
                text-anchor="middle" 
                dominant-baseline="middle" 
                style="font-family: sans-serif; font-size: ${SMALL_FONT_SIZE * scale}rem; fill: ${COLOR_NO_IMG_TEXT};"
              >No Image</text>
            `
            }
            <rect 
              x="${X_MALE_IMG * scale}" 
              y="${y}" 
              width="${MALE_IMG_WIDTH * scale}" 
              height="${IMG_HEIGHT * scale}" 
              fill="none" 
              stroke="${COLOR_IMG_STROKE}" 
              stroke-width="2" 
              rx="${IMG_RX * scale}"
            />
          </g>
        `;
        })
        .join('')}

      <!-- Female Participants -->
      ${females
        .map((p, i) => {
          const y = (TITLE_HEIGHT + PADDING + i * (IMG_HEIGHT + ROW_GAP)) * scale;
          const descFontSize = DESC_FONT_SIZE * scale * descScale;

          return `
          <g>
            <!-- Image Container -->
            <rect 
              x="${X_FEMALE_IMG * scale}" 
              y="${y}" 
              width="${FEMALE_IMG_WIDTH * scale}" 
              height="${IMG_HEIGHT * scale}" 
              fill="${COLOR_IMG_BG}" 
              rx="${IMG_RX * scale}"
            />
            ${
              p.image
                ? `
              <image 
                x="${X_FEMALE_IMG * scale}" 
                y="${y}" 
                width="${FEMALE_IMG_WIDTH * scale}" 
                height="${IMG_HEIGHT * scale}" 
                href="${p.image}" 
                preserveAspectRatio="xMidYMid slice"
              />`
                : `
              <text 
                x="${(X_FEMALE_IMG + FEMALE_IMG_WIDTH / TITLE_Y_DIVIDER) * scale}" 
                y="${y + (IMG_HEIGHT / TITLE_Y_DIVIDER) * scale}" 
                text-anchor="middle" 
                dominant-baseline="middle" 
                style="font-family: sans-serif; font-size: ${SMALL_FONT_SIZE * scale}rem; fill: ${COLOR_NO_IMG_TEXT};"
              >No Image</text>
            `
            }
            <rect 
              x="${X_FEMALE_IMG * scale}" 
              y="${y}" 
              width="${FEMALE_IMG_WIDTH * scale}" 
              height="${IMG_HEIGHT * scale}" 
              fill="none" 
              stroke="${COLOR_IMG_STROKE}" 
              stroke-width="2" 
              rx="${IMG_RX * scale}"
            />

            <!-- Name & Description (HTML-like wrapping) -->
            <foreignObject
              x="${X_FEMALE_TEXT * scale}"
              y="${y}"
              width="${FEMALE_TEXT_WIDTH * scale}"
              height="${IMG_HEIGHT * scale}"
            >
              <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; text-align: left; padding-left: ${TEXT_PADDING_8}px; height: 100%; justify-content: flex-start; padding-top: ${TEXT_PADDING_8}px; width: 100%; font-family: sans-serif;">
                <div style="font-weight: bold; font-size: ${NAME_FONT_SIZE * scale}rem; color: ${COLOR_FEMALE_NAME}; margin-bottom: ${MARGIN_BOTTOM_4}px;">${p.name}</div>
                <div style="font-size: ${descFontSize}rem; color: ${COLOR_FEMALE_DESC}; white-space: pre-wrap; word-wrap: break-word;">${p.description}</div>
              </div>
            </foreignObject>
          </g>
        `;
        })
        .join('')}

      <!-- Relationship Messages: Lines and arrows representing interactions -->
      <g>
        ${event.messages
          .map((m) => {
            const fromPos = personPositions[m.from];
            const toPos = personPositions[m.to];
            if (!fromPos || !toPos) {
              return '';
            }

            const { color, marker } = getMessageStyle(m.type, fromPos.gender);
            const { x1, y1, x2, y2 } = calculateMessageCoords(fromPos, toPos, scale);

            const markerEndAttr = marker ? `marker-end="url(#${marker})"` : '';

            /**
             * Special Routing for Same-gender Messages:
             * Redirects through the horizontal center of the middle column to prevent overlapping profile images.
             */
            if (fromPos.gender === toPos.gender) {
              const centerX = (X_MID + MID_WIDTH / TITLE_Y_DIVIDER) * scale;
              return `
              <g>
                <line x1="${x1}" y1="${y1}" x2="${centerX}" y2="${y2}" stroke="${color}" stroke-width="${MESSAGE_STROKE_WIDTH * scale}" />
                <line x1="${centerX}" y1="${y2}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${MESSAGE_STROKE_WIDTH * scale}" ${markerEndAttr} />
              </g>
            `;
            }

            // Normal straight-line arrows for cross-gender messages
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${MESSAGE_STROKE_WIDTH * scale}" ${markerEndAttr} />`;
          })
          .join('')}
      </g>

      <!-- Team Memberships: Group connections with dynamic horizontal spacing -->
      <g>
        ${(() => {
          // Filter to only include teams that have at least one valid member visible
          const concreteTeams = Object.entries(event.teams)
            .map(([originalIndex, members]) => {
              const validMembers = members
                .map((id) => {
                  return personPositions[id];
                })
                .filter((p) => {
                  return Boolean(p);
                });
              if (validMembers.length > 0) {
                return { originalIndex, validMembers };
              }
              return null;
            })
            .filter((t) => {
              return t !== null;
            }) as {
            originalIndex: string;
            validMembers: { x: number; y: number; gender: string }[];
          }[];

          return concreteTeams
            .map(({ originalIndex, validMembers }, concreteIndex) => {
              /**
               * teamY: Vertical center point (average height of members).
               * teamX: Dynamically distributed across the MID_WIDTH area based on active team count.
               */
              const avgY =
                validMembers.reduce((sum, p) => {
                  return sum + p.y;
                }, 0) / validMembers.length;
              const teamX =
                (X_MID + MID_WIDTH * ((concreteIndex + 1) / (concreteTeams.length + 1))) * scale;
              const teamY = avgY;
              const teamColor = TEAM_COLORS[Number(originalIndex)];

              return `
            <g>
              <circle cx="${teamX}" cy="${teamY}" r="${TEAM_HUB_RADIUS * scale}" fill="${teamColor}" />
              ${validMembers
                .map((p) => {
                  const { x1, y1 } = calculatTeamMemberCoords(p, scale);
                  return `
                    <line x1="${x1}" y1="${y1}" x2="${teamX}" y2="${teamY}" stroke="${teamColor}" stroke-width="${TEAM_LINE_STROKE_WIDTH * scale}" stroke-dasharray="${DASH_ARRAY_6 * scale} ${DASH_ARRAY_4 * scale}" />
                  `;
                })
                .join('')}
            </g>
          `;
            })
            .join('');
        })()}
      </g>
    </svg>
  `;

  return svgContent;
}
