const RANGE_STEP = 2;
const AVG_CHAR_WIDTH_FACTOR = 0.55;

/**
 * Layout Constants (Base dimensions in pixels before scaling)
 */
export const PADDING = 10; // Standard padding from the edges of the SVG
export const ROW_GAP = 10; // Vertical gap between participant rows
export const TITLE_HEIGHT = 60; // Height of the event title header
export const MALE_TEXT_WIDTH = 300; // Width of the male name/description column
export const MALE_IMG_WIDTH = 200; // Width of the male profile image
export const MID_WIDTH = 400; // Width of the central area for messages and teams
export const FEMALE_IMG_WIDTH = 200; // Width of the female profile image
export const FEMALE_TEXT_WIDTH = 300; // Width of the female name/description column
export const IMG_HEIGHT = 200; // Fixed height for all profile images

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
 * X-Coordinate Offsets (Horizontal positioning)
 */
export const X_MALE_TEXT = PADDING;
export const X_MALE_IMG = X_MALE_TEXT + MALE_TEXT_WIDTH + PADDING;
export const X_MID = X_MALE_IMG + MALE_IMG_WIDTH + PADDING;
export const X_FEMALE_IMG = X_MID + MID_WIDTH + PADDING;
export const X_FEMALE_TEXT = X_FEMALE_IMG + FEMALE_IMG_WIDTH + PADDING;
export const TOTAL_WIDTH = X_FEMALE_TEXT + FEMALE_TEXT_WIDTH + PADDING;

/**
 * Line Offsets for Message Visuals
 * These prevent arrows from overlapping perfectly when multiple messages target the same person.
 */
export const LINE_OFFSET_X = 10;
export const LINE_OFFSET_Y = 10;

/**
 * Filters the people list based on whether the current episode index falls within their 'ranges'.
 */
export function getFilteredPeople(data: any, episodeIndex: number) {
  if (episodeIndex <= 0) {
    return data.people;
  }
  return data.people.filter((p: any) => {
    const ranges = p.ranges
      .trim()
      .split(/\s+/)
      .filter((s: string) => {
        return s !== '';
      })
      .map((s: string) => {
        return Number(s);
      })
      .filter((n: number) => {
        return !isNaN(n);
      });
    if (ranges.length === 0) {
      return true; // Default to visible if no range specified
    }
    for (let i = 0; i < ranges.length; i += RANGE_STEP) {
      const start = ranges[i];
      const end = ranges[i + 1] !== undefined ? ranges[i + 1] : Infinity;
      if (episodeIndex >= start && episodeIndex <= end) {
        return true;
      }
    }
    return false;
  });
}

/**
 * Pre-calculates the center X and Y coordinates for every visible person.
 * Used as anchor points for drawing relationship lines and team connections.
 */
export function calculatePersonPositions(males: any[], females: any[], scale: number) {
  const pos: { [id: number]: { x: number; y: number; gender: string } } = {};

  // Males: Anchored to the right edge of their image
  males.forEach((p, i) => {
    const y = (TITLE_HEIGHT + PADDING + i * (IMG_HEIGHT + ROW_GAP) + IMG_HEIGHT / 2) * scale;
    const x = (X_MALE_IMG + MALE_IMG_WIDTH) * scale;
    pos[p.id] = { x, y, gender: 'male' };
  });

  // Females: Anchored to the left edge of their image
  females.forEach((p, i) => {
    const y = (TITLE_HEIGHT + PADDING + i * (IMG_HEIGHT + ROW_GAP) + IMG_HEIGHT / 2) * scale;
    const x = X_FEMALE_IMG * scale;
    pos[p.id] = { x, y, gender: 'female' };
  });

  return pos;
}

/**
 * Determines the color and arrowhead marker for a relationship message.
 */
export function getMessageStyle(type: string, gender: string) {
  const isMale = gender === 'male';
  let color;
  let marker;
  if (type === 'strong') {
    color = isMale ? '#2563eb' : '#dc2626'; // Bold Blue/Red
    marker = isMale ? 'arrowhead-blue' : 'arrowhead-red';
  } else if (type === 'weak') {
    color = isMale ? '#93c5fd' : '#fca5a5'; // Light Blue/Red
    marker = isMale ? 'arrowhead-lightblue' : 'arrowhead-lightred';
  } else {
    // bidirectional
    color = '#8B008B'; // Dark Magenta
    marker = undefined;
  }
  return { color, marker };
}

/**
 * Calculates start and end coordinates for a message arrow.
 * Applies vertical and horizontal offsets to ensure lines are distinct.
 */
export function calculateMessageCoords(
  fromPos: { x: number; y: number; gender: string },
  toPos: { x: number; y: number; gender: string },
  scale: number
) {
  const isMale = fromPos.gender === 'male';
  const targetIsMale = toPos.gender === 'male';

  // Offset Y: Males shift down, Females shift up to prevent overlap on same row
  const vOffset = (isMale ? LINE_OFFSET_Y : -LINE_OFFSET_Y) * scale;

  // Offset X: Move away from the image boundary slightly
  const hOffsetFrom = (isMale ? LINE_OFFSET_X : -LINE_OFFSET_X) * scale;
  const hOffsetTo = (targetIsMale ? LINE_OFFSET_X : -LINE_OFFSET_X) * scale;

  return {
    x1: fromPos.x + hOffsetFrom,
    y1: fromPos.y + vOffset,
    x2: toPos.x + hOffsetTo,
    y2: toPos.y + vOffset,
  };
}

/**
 * Calculates the anchor point on a person's image boundary for team membership lines.
 */
export function calculatTeamMemberCoords(
  pos: { x: number; y: number; gender: string },
  scale: number
) {
  const isMale = pos.gender === 'male';
  const hOffset = (isMale ? LINE_OFFSET_X : -LINE_OFFSET_X) * scale;

  return {
    x1: pos.x + hOffset,
    y1: pos.y, // Team lines are centered vertically on the image
  };
}

export const TEAM_COLORS = [
  '#10B981', // Emerald
  '#22D3EE', // Soft Cyan
  '#FB923C', // Tangerine
  '#A855F7', // Deep Violet
  '#A3E635', // Fresh Lime
  '#7FE7D1', // Seafoam
  '#FACC15', // Golden Yellow
  '#C084FC', // Orchid Purple
  '#C6F61A', // Chartreuse Green
  '#E6B422', // Honey Gold
];

/**
 * Wraps text into multiple lines based on a maximum width.
 * This is a simple implementation for SVG text rendering.
 */
export function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  // Approximate character width (0.6 * fontSize is a decent guess for sans-serif)
  const avgCharWidth = fontSize * AVG_CHAR_WIDTH_FACTOR;

  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length * avgCharWidth > maxWidth) {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}
