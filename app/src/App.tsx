import React from 'react';
import { Routes, Route, BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { IcpAuthProvider } from './contexts/IcpAuthContext';
import Dashboard from './pages/dashboard';

import AgreementPage from './pages/agreement';
import SignaturesPage from './pages/signatures';
import { MobileLayout } from './components/MobileLayout';
import { useCalimero } from '@calimero-network/calimero-client';

export default function App() {
  const { isAuthenticated } = useCalimero();
  return (
    <IcpAuthProvider>
      <ThemeProvider>
        <BrowserRouter basename="/mero-docs/">
          <MobileLayout>
            {isAuthenticated && <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/agreement" element={<AgreementPage />} />
              <Route path="/signatures" element={<SignaturesPage />} />
              <Route path="*" element={<Dashboard />} />
            </Routes>}
          </MobileLayout>
        </BrowserRouter>
      </ThemeProvider>
    </IcpAuthProvider>
  );
}
