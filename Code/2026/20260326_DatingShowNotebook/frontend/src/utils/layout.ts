import { AppData, Gender, MessageType } from '../store/useStore';

export const PADDING = 20;
export const ROW_GAP = 40;
export const TITLE_HEIGHT = 60;
export const MALE_TEXT_WIDTH = 300;
export const MALE_IMG_WIDTH = 200;
export const MID_WIDTH = 400;
export const FEMALE_IMG_WIDTH = 200;
export const FEMALE_TEXT_WIDTH = 300;
export const IMG_HEIGHT = 200;

export const X_MALE_TEXT = PADDING;
export const X_MALE_IMG = X_MALE_TEXT + MALE_TEXT_WIDTH + PADDING;
export const X_MID = X_MALE_IMG + MALE_IMG_WIDTH + PADDING;
export const X_FEMALE_IMG = X_MID + MID_WIDTH + PADDING;
export const X_FEMALE_TEXT = X_FEMALE_IMG + FEMALE_IMG_WIDTH + PADDING;
export const TOTAL_WIDTH = X_FEMALE_TEXT + FEMALE_TEXT_WIDTH + PADDING;

export function getFilteredPeople(data: AppData, episodeIndex: number) {
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
}

export function calculatePersonPositions(males: any[], females: any[], scale: number) {
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
}

export function getMessageStyle(type: MessageType, gender: Gender) {
  const isMale = gender === 'male';
  let color = '';
  let marker = '';
  if (type === 'strong') {
    color = isMale ? '#2563eb' : '#dc2626';
    marker = isMale ? 'arrowhead-blue' : 'arrowhead-red';
  } else {
    color = isMale ? '#93c5fd' : '#fca5a5';
    marker = isMale ? 'arrowhead-lightblue' : 'arrowhead-lightred';
  }
  return { color, marker };
}

export function calculateMessageCoords(fromPos: { x: number, y: number, gender: Gender }, toPos: { x: number, y: number, gender: Gender }, scale: number) {
  const isMale = fromPos.gender === 'male';
  const targetIsMale = toPos.gender === 'male';
  const vOffset = (isMale ? 10 : -10) * scale;
  const hOffsetFrom = (isMale ? 10 : -10) * scale;
  const hOffsetTo = (targetIsMale ? 10 : -10) * scale;

  return {
    x1: fromPos.x + hOffsetFrom,
    y1: fromPos.y + vOffset,
    x2: toPos.x + hOffsetTo,
    y2: toPos.y + vOffset
  };
}

export const TEAM_COLORS = ['#f97316', '#06b6d4', '#a855f7', '#84cc16', '#eab308'];
