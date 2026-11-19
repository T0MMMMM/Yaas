import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme/tokens.css'
import './theme/global.css'
import { App } from './app/App'

const root = document.getElementById('root')
if (!root) throw new Error('#root missing in index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
