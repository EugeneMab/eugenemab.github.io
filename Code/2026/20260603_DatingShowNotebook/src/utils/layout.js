/**
 * Layout Constants (Base dimensions in pixels before scaling)
 */
export const PADDING = 10;
export const ROW_GAP = 10;
export const TITLE_HEIGHT = 60;
export const MALE_TEXT_WIDTH = 300;
export const MALE_IMG_WIDTH = 200;
export const MID_WIDTH = 400;
export const FEMALE_IMG_WIDTH = 200;
export const FEMALE_TEXT_WIDTH = 300;
export const IMG_HEIGHT = 200;

/**
 * Visual Styles
 */
export const SELECTION_PADDING = 6;
export const SELECTION_STROKE_WIDTH = 4;
export const SELECTION_CORNER_RADIUS = 8;
export const MESSAGE_STROKE_WIDTH = 2;
export const TEAM_HUB_RADIUS = 6;
export const TEAM_LINE_STROKE_WIDTH = 3;

/**
 * Font Sizes (in rem units)
 */
export const TITLE_FONT_SIZE = 2;
export const NAME_FONT_SIZE = 1.8;
export const DESC_FONT_SIZE = 0.875;
export const SMALL_FONT_SIZE = 0.75;

/**
 * X-Coordinate Offsets
 */
export const X_MALE_TEXT = PADDING;
export const X_MALE_IMG = X_MALE_TEXT + MALE_TEXT_WIDTH + PADDING;
export const X_MID = X_MALE_IMG + MALE_IMG_WIDTH + PADDING;
export const X_FEMALE_IMG = X_MID + MID_WIDTH + PADDING;
export const X_FEMALE_TEXT = X_FEMALE_IMG + FEMALE_IMG_WIDTH + PADDING;
export const TOTAL_WIDTH = X_FEMALE_TEXT + FEMALE_TEXT_WIDTH + PADDING;

export const LINE_OFFSET_X = 10;
export const LINE_OFFSET_Y = 10;

export const TEAM_COLORS = [
  '#10B981', '#22D3EE', '#FB923C', '#A855F7', '#A3E635',
  '#7FE7D1', '#FACC15', '#C084FC', '#C6F61A', '#E6B422'
];

export function getFilteredPeople(data, episodeIndex) {
  if (episodeIndex <= 0) return data.people;
  return data.people.filter(p => {
    const ranges = p.ranges.trim().split(/\s+/).filter(s => s !== '').map(Number).filter(n => !isNaN(n));
    if (ranges.length === 0) return true;
    for (let i = 0; i < ranges.length; i += 2) {
      const start = ranges[i];
      const end = ranges[i + 1] !== undefined ? ranges[i + 1] : Infinity;
      if (episodeIndex >= start && episodeIndex <= end) return true;
    }
    return false;
  });
}

export function calculatePersonPositions(males, females, scale) {
  const pos = {};
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
}

export function getMessageStyle(type, gender) {
  const isMale = gender === 'male';
  let color;
  let marker;
  if (type === 'strong') {
    color = isMale ? '#2563eb' : '#dc2626';
    marker = isMale ? 'arrowhead-blue' : 'arrowhead-red';
  } else if (type === 'weak') {
    color = isMale ? '#93c5fd' : '#fca5a5';
    marker = isMale ? 'arrowhead-lightblue' : 'arrowhead-lightred';
  } else {
    color = '#8B008B';
    marker = undefined;
  }
  return { color, marker };
}

export function calculateMessageCoords(fromPos, toPos, scale, type) {
  const isMale = fromPos.gender === 'male';
  const targetIsMale = toPos.gender === 'male';
  const hOffsetFrom = (isMale ? LINE_OFFSET_X : -LINE_OFFSET_X) * scale;
  const hOffsetTo = (targetIsMale ? LINE_OFFSET_X : -LINE_OFFSET_X) * scale;
  if (type === 'bidirectional') {
    return { x1: fromPos.x + hOffsetFrom, y1: fromPos.y, x2: toPos.x + hOffsetTo, y2: toPos.y };
  }
  const vOffset = (isMale ? LINE_OFFSET_Y : -LINE_OFFSET_Y) * scale;
  return { x1: fromPos.x + hOffsetFrom, y1: fromPos.y + vOffset, x2: toPos.x + hOffsetTo, y2: toPos.y + vOffset };
}

export function calculatTeamMemberCoords(pos, scale) {
  const isMale = pos.gender === 'male';
  const hOffset = (isMale ? LINE_OFFSET_X : -LINE_OFFSET_X) * scale;
  return { x1: pos.x + hOffset, y1: pos.y };
}

export function wrapText(text, maxWidth, fontSize) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';
  const avgCharWidth = fontSize * 0.55;
  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length * avgCharWidth > maxWidth) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });
  if (currentLine) lines.push(currentLine);
  return lines;
}
