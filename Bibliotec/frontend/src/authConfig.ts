export const msalConfig = {
    auth: {
        clientId: "75491bfa-6e39-4c6b-a2b2-6ec76aa5034f",
        authority: "https://login.microsoftonline.com/2e94df95-bfac-40c7-b527-a26613562c45",
        redirectUri: window.location.origin,
        navigateToLoginRequestUrl: false,
    },
    cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: true,
    }
};

export const loginRequest = {
    scopes: ["User.Read"]
};