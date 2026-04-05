import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import keycloak from './keycloak'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5000, retry: 1 } },
})

function renderApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  )
}

const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL
const authDisabled = !keycloakUrl || keycloakUrl === 'https://your-keycloak-host'

if (authDisabled) {
  renderApp()
} else {
  keycloak.init({ onLoad: 'login-required', pkceMethod: 'S256' }).then((authenticated) => {
    if (!authenticated) return;
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).catch(() => keycloak.login());
    };
    renderApp()
  })
}
