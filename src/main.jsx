import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import { PermissionsProvider } from './context/PermissionsContext'
import './styles.css'
// Este archivo se importa al final para asegurar que la paleta elegida tenga prioridad.
import './brand-overrides.css'
import './datatable.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><BrowserRouter><AuthProvider><PermissionsProvider><App /></PermissionsProvider></AuthProvider></BrowserRouter></React.StrictMode>
)
