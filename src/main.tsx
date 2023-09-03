import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import '@fontsource/ibm-plex-sans-condensed';
import '@fontsource-variable/inter';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Root from './routes/Root';
import Error from './routes/Error';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    errorElement: <Error />,
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
