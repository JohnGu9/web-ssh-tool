import 'core-js/es/map';
import 'core-js/es/set';
import 'raf/polyfill';
import './index.css';
import 'material-icons/iconfont/filled.css';
import 'rmwc/dist/styles';

import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import reportWebVitals from './reportWebVitals';

if (process.env.NODE_ENV === 'development') {
  // rmwc cause a lot of warning that waste console resource
  // disable rmwc warning
  const error = console.error;
  const logError = (...parameters: Parameters<typeof error>) => {
    let filter = parameters.find(parameter => {
      return (
        // Filter error because XXX
        parameter.includes("Warning: %s is deprecated in StrictMode")
        // Another error to filter because of YYYY
        || parameter.includes("Warning:")
      );
    });
    if (!filter) error(...parameters);
  }
  console.error = logError;
}

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
