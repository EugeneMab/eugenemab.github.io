import { describe, it, expect } from 'vitest';
import { renderEventToSvgString } from './svgRenderer';
import { AppData, Event } from '../store/useStore';

describe('svgRenderer', () => {
  const mockData: AppData = {
    people: [
      { id: 1, gender: 'male', name: 'Male 1', image: '', description: 'M desc', ranges: '1' },
      { id: 2, gender: 'female', name: 'Female 1', image: '', description: 'F desc', ranges: '1' },
    ],
    episodes: [],
    nextUniqueId: 3,
    bodyScale: 1,
    descriptionScale: 1,
  };

  const mockEvent: Event = {
    id: 10,
    title: 'Test Event',
    messages: [
      { from: 1, to: 2, type: 'strong' },
      { from: 1, to: 1, type: 'weak' }, // same gender
    ],
    teams: {
      '0': [1, 2]
    }
  };

  it('renders same-gender messages with specialized routing', () => {
      const sameGenderEvent: Event = {
          id: 12, title: 'Same Gender',
          messages: [{ from: 1, to: 1, type: 'weak' }],
          teams: {}
      };
      const svg = renderEventToSvgString(sameGenderEvent, mockData, 1);
      expect(svg).toContain('Same Gender');
      // Should have two lines for same-gender routing
      const lines = svg.match(/<line/g);
      expect(lines?.length).toBeGreaterThan(1);
  });

  it('renders event to SVG string correctly', () => {
    const svg = renderEventToSvgString(mockEvent, mockData, 1);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Test Event');
    expect(svg).toContain('Male 1');
    expect(svg).toContain('Female 1');
    expect(svg).toContain('arrowhead-blue');
    expect(svg).toContain('circle'); // team hub
    expect(svg).toContain('line'); // messages and team lines
  });

  it('handles empty messages and teams', () => {
      const emptyEvent: Event = { id: 11, title: 'Empty', messages: [], teams: {} };
      const svg = renderEventToSvgString(emptyEvent, mockData, 1);
      expect(svg).toContain('Empty');
      expect(svg).not.toContain('circle');
  });
});
