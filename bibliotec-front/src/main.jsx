import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalConfig } from './authConfig'


const msalInstance = new PublicClientApplication(msalConfig);

async function iniciarApp() {
    try {
        // Inicializa os componentes internos da Microsoft
        await msalInstance.initialize();

        await msalInstance.handleRedirectPromise();

        // Só renderiza o React depois que a Azure deu ok
        ReactDOM.createRoot(document.getElementById('root')).render(
            <MsalProvider instance={msalInstance}>
                <App />
            </MsalProvider>
        );
    } catch (error) {
        console.error("Erro ao inicializar o MSAL da Microsoft:", error);
    }
}

iniciarApp();