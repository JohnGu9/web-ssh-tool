import 'core-js/es/map';
import 'core-js/es/set';
import 'raf/polyfill';
import './index.css';
import 'material-icons/iconfont/material-icons.css';
import App from './App';
// import reportWebVitals from './reportWebVitals';
import { createRoot } from 'react-dom/client';

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<App />);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
