export const msalConfig = {
    auth: {
        clientId: "75491bfa-6e39-4c6b-a2b2-6ec76aa5034f",
        authority: "https://login.microsoftonline.com/2e94df95-bfac-40c7-b527-a26613562c45",
        redirectUri: "http://localhost:3000", // URL dinâmica do AI Studio em vez do localhost estático
        navigateToLoginRequestUrl: false, 
    },
    cache: {
        cacheLocation: "localStorage", // Onde o token vai ficar guardado no navegador
        storeAuthStateInCookie: true,
    }
};

export const loginRequest = {
    scopes: ["User.Read"] // Escopo padrão para ler o perfil do usuário
};
