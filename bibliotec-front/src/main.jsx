import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalConfig } from './authConfig'

// 1. Cria a instância normal
const msalInstance = new PublicClientApplication(msalConfig);

// 2. Cria uma função assíncrona para inicializar a Azure ANTES de renderizar a tela
async function iniciarApp() {
    try {
        // 🛡️ A LINHA QUE FALTAVA: Inicializa os componentes internos da Microsoft
        await msalInstance.initialize();

        // Trata qualquer retorno de redirecionamento pendente
        await msalInstance.handleRedirectPromise();

        // 3. Só renderiza o React depois que a Azure deu o "OK, estou pronta!"
        ReactDOM.createRoot(document.getElementById('root')).render(
            <MsalProvider instance={msalInstance}>
                <App />
            </MsalProvider>
        );
    } catch (error) {
        console.error("Erro ao inicializar o MSAL da Microsoft:", error);
    }
}

// Dispara a inicialização
iniciarApp();