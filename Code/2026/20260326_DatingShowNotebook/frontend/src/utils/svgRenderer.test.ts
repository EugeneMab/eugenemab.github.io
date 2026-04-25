/* Unit tests for the SVG string generation logic used for exporting event images. */
import { describe, it, expect } from 'vitest';
import { renderEventToSvgString } from './svgRenderer';
import { AppData, Event } from '../store/useStore';

describe('svgRenderer', () => {
  const mockData: AppData = {
    people: [
      {
        id: 1,
        gender: 'male',
        name: 'Male 1',
        image: 'data:image/png;base64,abc',
        description: 'M desc',
        ranges: '1',
      },
      { id: 2, gender: 'female', name: 'Female 1', image: '', description: 'F desc', ranges: '1' },
      { id: 3, gender: 'male', name: 'Male 2', image: '', description: 'M2 desc', ranges: '1' },
      {
        id: 4,
        gender: 'female',
        name: 'Female 2',
        image: 'data:image/png;base64,def',
        description: 'F2 desc',
        ranges: '1',
      },
    ],
    episodes: [],
    nextUniqueId: 5,
    bodyScale: 1,
    descriptionScale: 1,
  };

  const mockEvent: Event = {
    id: 10,
    title: 'Test Event',
    messages: [
      { from: 1, to: 2, type: 'strong' },
      { from: 1, to: 3, type: 'weak' }, // same gender
      { from: 2, to: 1, type: 'bidirectional' },
    ],
    teams: {
      '0': [1, 2],
      '1': [99], // invalid member
    },
  };

  /* Tests the complex path routing used to prevent overlapping lines for same-gender relationships. */
  it('renders same-gender messages with specialized routing', () => {
    const sameGenderEvent: Event = {
      id: 12,
      title: 'Same Gender',
      messages: [{ from: 1, to: 3, type: 'weak' }],
      teams: {},
    };
    const svg = renderEventToSvgString(sameGenderEvent, mockData, 1);
    expect(svg).toContain('Same Gender');
    // Should have two lines for same-gender routing
    const lines = svg.match(/<line/g);
    expect(lines?.length).toBeGreaterThan(1);
  });

  /* Verifies that the primary SVG rendering function produces valid XML with expected content. */
  it('renders event to SVG string correctly', () => {
    const svg = renderEventToSvgString(mockEvent, mockData, 1);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Test Event');
    expect(svg).toContain('Male 1');
    expect(svg).toContain('Female 1');
    expect(svg).toContain('arrowhead-blue');
    expect(svg).toContain('circle'); // team hub
    expect(svg).toContain('line'); // messages and team lines
    expect(svg).toContain('href="data:image/png;base64,abc"');
    expect(svg).toContain('No Image');
    expect(svg).toContain('stroke="#8B008B"'); // bidirectional color
  });

  /* Tests that default values are used when optional data fields are missing. */
  it('uses default descriptionScale and handles missing images', () => {
    const sparseData = {
      ...mockData,
      descriptionScale: undefined,
    } as unknown as AppData;
    const svg = renderEventToSvgString(mockEvent, sparseData, 1);
    expect(svg).toContain('font-size: 0.875rem'); // DESC_FONT_SIZE * 1
  });

  /* Ensures the renderer handles events with no active connections without errors. */
  it('handles empty messages and teams', () => {
    const emptyEvent: Event = { id: 11, title: 'Empty', messages: [], teams: {} };
    const svg = renderEventToSvgString(emptyEvent, mockData, 1);
    expect(svg).toContain('Empty');
    expect(svg).not.toContain('circle');
  });

  /* Tests handling of messages with invalid person IDs. */
  it('ignores messages with invalid person IDs', () => {
    const invalidMsgEvent: Event = {
      id: 13,
      title: 'Invalid IDs',
      messages: [{ from: 1, to: 99, type: 'strong' }],
      teams: {},
    };
    const svg = renderEventToSvgString(invalidMsgEvent, mockData, 1);
    // Definitions are always present, but usage in line should be absent
    const linesWithMarkers = svg.match(/<line[^>]+marker-end/g);
    expect(linesWithMarkers).toBeNull();
  });

  /* Tests handling of teams with no visible members. */
  it('ignores teams with no valid members', () => {
    const invalidTeamEvent: Event = {
      id: 14,
      title: 'Invalid Team',
      messages: [],
      teams: { '0': [99] },
    };
    const svg = renderEventToSvgString(invalidTeamEvent, mockData, 1);
    expect(svg).not.toContain('circle');
  });
});
