import htm from '../../lib/htm.js';

// Getters to ensure React is defined when used
const React = window.React;
const ReactDOM = window.ReactDOM;
const LucideReact = window.LucideReact;
const html = htm.bind(window.React ? window.React.createElement : () => null);

export { html, React, ReactDOM, LucideReact };
