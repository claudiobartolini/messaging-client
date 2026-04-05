import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? 'https://your-keycloak-host',
  realm: import.meta.env.VITE_KEYCLOAK_REALM ?? 'your-realm',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'messaging-client',
});

export default keycloak;
