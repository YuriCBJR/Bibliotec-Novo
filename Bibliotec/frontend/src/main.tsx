import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

import { PublicClientApplication, EventType } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from './authConfig';

const msalInstance = new PublicClientApplication(msalConfig);

msalInstance.initialize().then(() => {
    // Processa o retorno do redirect do Azure
    msalInstance.handleRedirectPromise().then((result) => {
        if (result && result.account) {
            msalInstance.setActiveAccount(result.account);
        }
    });

    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <MsalProvider instance={msalInstance}>
                <App />
            </MsalProvider>
        </React.StrictMode>
    );
});