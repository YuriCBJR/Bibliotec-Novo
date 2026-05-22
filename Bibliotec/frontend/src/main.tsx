import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 🔷 Importações oficiais do MSAL
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from './authConfig';

// 1. Inicializa a instância real do cliente Azure
const msalInstance = new PublicClientApplication(msalConfig);

// 🔒 Como estamos usando exclusivamente POPUP, nós NÃO chamamos o handleRedirectPromise aqui!
// Isso evita que o MSAL limpe ou procure um cache de redirect que não existe.

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <MsalProvider instance={msalInstance}>
            <App />
        </MsalProvider>
    </React.StrictMode>
);