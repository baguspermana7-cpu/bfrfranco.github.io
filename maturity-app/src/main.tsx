import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { MaturityProvider } from './context/MaturityContext'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <MaturityProvider>
      <App />
    </MaturityProvider>
  </React.StrictMode>,
)
