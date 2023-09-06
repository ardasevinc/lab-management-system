import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import '@fontsource/ibm-plex-sans-condensed';
import '@fontsource-variable/inter';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Root from '@/routes/layouts/Root';
import Error from '@/routes/Error';
import Dashboard from '@/routes/Dashboard';
import Devices from '@/routes/Devices';
import Logs from '@/routes/Logs';
import Network from '@/routes/Network';
import Schedule from '@/routes/Schedule';
import Users from '@/routes/Users';
import Settings from '@/routes/Settings';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    errorElement: <Error />,
    children: [
      { path: '/', element: <Dashboard /> },
      {
        path: '/devices',
        element: <Devices />,
      },
      {
        path: '/network',
        element: <Network />,
      },
      {
        path: '/logs',
        element: <Logs />,
      },
      {
        path: '/schedule',
        element: <Schedule />,
      },
      {
        path: '/users',
        element: <Users />,
      },
      {
        path: '/settings',
        element: <Settings />,
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
