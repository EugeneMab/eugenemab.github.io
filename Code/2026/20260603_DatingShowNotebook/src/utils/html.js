import htm from '../../lib/htm.js';

// Access React and ReactDOM from window
const React = window.React;
const ReactDOM = window.ReactDOM;
const LucideReact = window.LucideReact;

if (!React) {
  console.error('React not found on window object!');
}

if (!LucideReact) {
  console.warn('LucideReact not found on window object!');
}

// Bind htm to React.createElement
const html = htm.bind(React ? React.createElement : (type) => {
  console.error('React.createElement called before initialization for type:', type);
  return null;
});

export { html, React, ReactDOM, LucideReact };
