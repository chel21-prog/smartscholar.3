import './styles/tokens.css'
import './index.css'
import './styles/tables.css'
import App from './App.jsx'
import { initPinnedColumns } from './lib/pinnedColumns'
import { initExpandOnHover } from './lib/expandOnHover'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { SessionProvider } from './context/SessionContext'
import { ToastProvider } from './context/ToastContext'

initPinnedColumns()
initExpandOnHover()

ReactDOM.createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <ToastProvider>
      <SessionProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SessionProvider>
    </ToastProvider>
  </ThemeProvider>
)