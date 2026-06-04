import { html } from '../utils/html.js';
import { MainBody } from './MainBody.js';
import { PersonView } from './PersonView.js';

export const AppContent = ({ data, setData, activeMode, selectedEpisodeId, selectedEventId }) => {
  if (selectedEpisodeId === null) {
    return html`<${PersonView} data=${data} setData=${setData} />`;
  }

  return html`
    <${MainBody} 
      data=${data} 
      setData=${setData} 
      activeMode=${activeMode} 
      selectedEpisodeId=${selectedEpisodeId} 
      selectedEventId=${selectedEventId} 
    />
  `;
};
