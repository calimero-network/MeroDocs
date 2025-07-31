import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AppMode, CalimeroProvider } from '@calimero-network/calimero-client';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

const APPLICATION_ID = 'HPzUFHgY5tCfHt4ErFpr5GJsRUkUp8bMShYay4XJ6UUU';
const APPLICATION_PATH = 'https://calimero-only-peers-dev.s3.amazonaws.com/uploads/a87606c3bdf4d6dbeaffe918c35f9e2a.wasm';

root.render(
  <React.StrictMode>
    <CalimeroProvider
      clientApplicationId={APPLICATION_ID}
      mode={AppMode.MultiContext}
      applicationPath={APPLICATION_PATH}
    >
      <App />
    </CalimeroProvider>
  </React.StrictMode>,
);


// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
