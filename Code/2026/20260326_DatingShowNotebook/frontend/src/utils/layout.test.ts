/* Unit tests for layout calculation utilities and participant filtering logic. */
import { describe, it, expect } from 'vitest';
import {
  getFilteredPeople,
  calculatePersonPositions,
  getMessageStyle,
  calculateMessageCoords,
  calculatTeamMemberCoords,
  wrapText,
} from './layout';
import { AppData, Person } from '../store/useStore';

describe('layout utils', () => {
  const mockPerson: Person = {
    id: 1,
    gender: 'male',
    name: 'Male 1',
    image: '',
    description: 'desc',
    ranges: '1 2 4',
  };

  const mockData: AppData = {
    people: [mockPerson],
    episodes: [],
    nextUniqueId: 2,
    bodyScale: 1,
    descriptionScale: 1,
  };

  describe('getFilteredPeople', () => {
    /* Verifies that all participants are visible when no specific episode is selected. */
    it('returns all people if episodeIndex is 0', () => {
      expect(getFilteredPeople(mockData, 0)).toEqual(mockData.people);
    });

    /* Tests participant visibility across multiple episodes using numeric range strings. */
    it('filters people correctly based on ranges', () => {
      expect(getFilteredPeople(mockData, 1)).toHaveLength(1);
      expect(getFilteredPeople(mockData, 2)).toHaveLength(1);
      expect(getFilteredPeople(mockData, 3)).toHaveLength(0);
      expect(getFilteredPeople(mockData, 4)).toHaveLength(1);
      expect(getFilteredPeople(mockData, 5)).toHaveLength(1); // 4 onwards
    });

    /* Ensures participants with no specified range are visible by default in all episodes. */
    it('returns true if range is empty', () => {
        const dataWithEmptyRange: AppData = {
            ...mockData,
            people: [{ ...mockPerson, ranges: '' }]
        };
        expect(getFilteredPeople(dataWithEmptyRange, 10)).toHaveLength(1);
    });
  });

  describe('calculatePersonPositions', () => {
    /* Verifies the coordinate mapping for participants within the SVG layout. */
    it('calculates male and female positions correctly', () => {
      const males: Person[] = [{ ...mockPerson, id: 1, gender: 'male' }];
      const females: Person[] = [{ ...mockPerson, id: 2, gender: 'female' }];
      const scale = 1;
      const positions = calculatePersonPositions(males, females, scale);
      
      expect(positions[1].gender).toBe('male');
      expect(positions[2].gender).toBe('female');
      expect(positions[1].x).toBeGreaterThan(0);
      expect(positions[2].x).toBeGreaterThan(positions[1].x);
    });
  });

  describe('getMessageStyle', () => {
    /* Tests the visual styling logic for relationship arrows based on gender and message type. */
    it('returns correct style for strong male message', () => {
      const style = getMessageStyle('strong', 'male');
      expect(style.color).toBe('#2563eb');
      expect(style.marker).toBe('arrowhead-blue');
    });

    /* Checks styling for weak relationship indicators for female participants. */
    it('returns correct style for weak female message', () => {
      const style = getMessageStyle('weak', 'female');
      expect(style.color).toBe('#fca5a5');
      expect(style.marker).toBe('arrowhead-lightred');
    });

    /* Verifies the distinct styling used for mutual relationship connections. */
    it('returns correct style for bidirectional message', () => {
      const style = getMessageStyle('bidirectional', 'male');
      expect(style.color).toBe('#8B008B');
      expect(style.marker).toBeUndefined();
    });
  });

  describe('calculateMessageCoords', () => {
      /* Tests the calculation of message line endpoints, including scaling factors. */
      it('calculates coords with scale', () => {
          const fromPos = { x: 100, y: 100, gender: 'male' as const };
          const toPos = { x: 500, y: 100, gender: 'female' as const };
          const coords = calculateMessageCoords(fromPos, toPos, 1);
          expect(coords.x1).toBe(110);
          expect(coords.y1).toBe(110);
      });
  });

  describe('calculatTeamMemberCoords', () => {
    /* Verifies the anchor point calculations for team connection lines. */
    it('calculates coords correctly', () => {
        const pos = { x: 100, y: 100, gender: 'male' as const };
        const coords = calculatTeamMemberCoords(pos, 1);
        expect(coords.x1).toBe(110);
        expect(coords.y1).toBe(100);
    });
  });

  describe('wrapText', () => {
    /* Tests the simple text-wrapping algorithm used for SVG descriptions. */
    it('wraps long text into lines', () => {
      const lines = wrapText('This is a long text that should be wrapped', 50, 16);
      expect(lines.length).toBeGreaterThan(1);
    });
  });
});
