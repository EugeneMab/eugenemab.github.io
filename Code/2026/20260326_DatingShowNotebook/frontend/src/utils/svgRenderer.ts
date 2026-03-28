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
  TEAM_COLORS,
} from './layout';

export function renderEventToSvgString(event: Event, data: AppData, episodeIndex: number): string {
  const filteredPeople = getFilteredPeople(data, episodeIndex);
  const males = filteredPeople.filter((p) => p.gender === 'male');
  const females = filteredPeople.filter((p) => p.gender === 'female');

  const scale = data.bodyScale || 1;
  const descScale = data.descriptionScale || 1;
  const numRows = Math.max(males.length, females.length);
  const totalWidth = (X_FEMALE_TEXT + FEMALE_TEXT_WIDTH + PADDING) * scale;
  const totalHeight = (TITLE_HEIGHT + PADDING + numRows * (IMG_HEIGHT + ROW_GAP)) * scale;

  const personPositions = calculatePersonPositions(males, females, scale);

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" style="background: white;">
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

      <rect width="100%" height="100%" fill="white" />

      <!-- Title -->
      <rect x="0" y="0" width="${totalWidth}" height="${TITLE_HEIGHT * scale}" fill="#f9fafb" />
      <line x1="0" y1="${TITLE_HEIGHT * scale}" x2="${totalWidth}" y2="${TITLE_HEIGHT * scale}" stroke="#f3f4f6" stroke-width="1" />
      <text 
        x="${totalWidth / 2}" 
        y="${(TITLE_HEIGHT * scale) / 2}" 
        text-anchor="middle" 
        dominant-baseline="middle" 
        style="font-family: sans-serif; font-weight: bold; font-size: ${2 * scale}rem;"
      >${event.title}</text>

      <!-- Males -->
      ${males
        .map((p, i) => {
          const y = (TITLE_HEIGHT + PADDING + i * (IMG_HEIGHT + ROW_GAP)) * scale;
          const descLines = p.description.split('\n');
          const descFontSize = 0.875 * scale * descScale;

          return `
          <g>
            <!-- Name -->
            <text 
              x="${(X_MALE_TEXT + MALE_TEXT_WIDTH) * scale}" 
              y="${y + 20 * scale}" 
              text-anchor="end" 
              style="font-family: sans-serif; font-weight: bold; font-size: ${1.125 * scale}rem; fill: #1e3a8a;"
            >${p.name}</text>
            
            <!-- Description -->
            ${descLines
              .map(
                (line, lineIdx) => `
              <text 
                x="${(X_MALE_TEXT + MALE_TEXT_WIDTH) * scale}" 
                y="${y + 45 * scale + lineIdx * descFontSize * 1.2 * 16}" 
                text-anchor="end" 
                style="font-family: sans-serif; font-size: ${descFontSize}rem; fill: #1e40af;"
              >${line}</text>
            `
              )
              .join('')}

            <!-- Image Area -->
            <rect 
              x="${X_MALE_IMG * scale}" 
              y="${y}" 
              width="${MALE_IMG_WIDTH * scale}" 
              height="${IMG_HEIGHT * scale}" 
              fill="#e5e7eb" 
              rx="${4 * scale}"
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
                x="${(X_MALE_IMG + MALE_IMG_WIDTH / 2) * scale}" 
                y="${y + (IMG_HEIGHT / 2) * scale}" 
                text-anchor="middle" 
                dominant-baseline="middle" 
                style="font-family: sans-serif; font-size: ${0.75 * scale}rem; fill: #6b7280;"
              >No Image</text>
            `
            }
            <rect 
              x="${X_MALE_IMG * scale}" 
              y="${y}" 
              width="${MALE_IMG_WIDTH * scale}" 
              height="${IMG_HEIGHT * scale}" 
              fill="none" 
              stroke="#d1d5db" 
              stroke-width="${2 * scale}" 
              rx="${4 * scale}"
            />
          </g>
        `;
        })
        .join('')}

      <!-- Females -->
      ${females
        .map((p, i) => {
          const y = (TITLE_HEIGHT + PADDING + i * (IMG_HEIGHT + ROW_GAP)) * scale;
          const descLines = p.description.split('\n');
          const descFontSize = 0.875 * scale * descScale;

          return `
          <g>
            <!-- Image Area -->
            <rect 
              x="${X_FEMALE_IMG * scale}" 
              y="${y}" 
              width="${FEMALE_IMG_WIDTH * scale}" 
              height="${IMG_HEIGHT * scale}" 
              fill="#e5e7eb" 
              rx="${4 * scale}"
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
                x="${(X_FEMALE_IMG + FEMALE_IMG_WIDTH / 2) * scale}" 
                y="${y + (IMG_HEIGHT / 2) * scale}" 
                text-anchor="middle" 
                dominant-baseline="middle" 
                style="font-family: sans-serif; font-size: ${0.75 * scale}rem; fill: #6b7280;"
              >No Image</text>
            `
            }
            <rect 
              x="${X_FEMALE_IMG * scale}" 
              y="${y}" 
              width="${FEMALE_IMG_WIDTH * scale}" 
              height="${IMG_HEIGHT * scale}" 
              fill="none" 
              stroke="#d1d5db" 
              stroke-width="${2 * scale}" 
              rx="${4 * scale}"
            />

            <!-- Name -->
            <text 
              x="${X_FEMALE_TEXT * scale}" 
              y="${y + 20 * scale}" 
              text-anchor="start" 
              style="font-family: sans-serif; font-weight: bold; font-size: ${1.125 * scale}rem; fill: #7f1d1d;"
            >${p.name}</text>
            
            <!-- Description -->
            ${descLines
              .map(
                (line, lineIdx) => `
              <text 
                x="${X_FEMALE_TEXT * scale}" 
                y="${y + 45 * scale + lineIdx * descFontSize * 1.2 * 16}" 
                text-anchor="start" 
                style="font-family: sans-serif; font-size: ${descFontSize}rem; fill: #991b1b;"
              >${line}</text>
            `
              )
              .join('')}
          </g>
        `;
        })
        .join('')}

      <!-- Messages -->
      <g>
        ${event.messages
          .map((m) => {
            const fromPos = personPositions[m.from];
            const toPos = personPositions[m.to];
            if (!fromPos || !toPos) return '';

            const { color, marker } = getMessageStyle(m.type, fromPos.gender);
            const { x1, y1, x2, y2 } = calculateMessageCoords(fromPos, toPos, scale);

            if (fromPos.gender === toPos.gender) {
              const centerX = (X_MID + MID_WIDTH / 2) * scale;
              return `
              <g>
                <line x1="${x1}" y1="${y1}" x2="${centerX}" y2="${y2}" stroke="${color}" stroke-width="${2 * scale}" />
                <line x1="${centerX}" y1="${y2}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${2 * scale}" marker-end="url(#${marker})" />
              </g>
            `;
            }

            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${2 * scale}" marker-end="url(#${marker})" />`;
          })
          .join('')}
      </g>

      <!-- Teams -->
      <g>
        ${Object.entries(event.teams)
          .map(([idx, members]) => {
            if (members.length === 0) return '';
            const validMembers = members.map((id) => personPositions[id]).filter(Boolean);
            if (validMembers.length === 0) return '';

            const avgY = validMembers.reduce((sum, p) => sum + p.y, 0) / validMembers.length;
            const teamX = (X_MID + MID_WIDTH * ((Number(idx) + 1) / (5 + 1))) * scale;
            const teamY = avgY;

            return `
            <g>
              <circle cx="${teamX}" cy="${teamY}" r="${6 * scale}" fill="${TEAM_COLORS[Number(idx)]}" />
              ${validMembers
                .map(
                  (p) => `
                <line x1="${p.x}" y1="${p.y}" x2="${teamX}" y2="${teamY}" stroke="${TEAM_COLORS[Number(idx)]}" stroke-width="${1.5 * scale}" stroke-dasharray="${4 * scale}" />
              `
                )
                .join('')}
            </g>
          `;
          })
          .join('')}
      </g>
    </svg>
  `;

  return svgContent;
}
