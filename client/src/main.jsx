import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// Apply saved theme before first paint to avoid flash
const t = localStorage.getItem('mhs-theme');
if (t) document.documentElement.dataset.theme = t;

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
