import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import { MotionConfig } from 'motion/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import IntroLoader from '@/components/intro/IntroLoader'
import './index.css'
import App from './App'
import { initSfx } from '@/lib/sfx'

initSfx()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          <App />
          <IntroLoader />
        </TooltipProvider>
      </MotionConfig>
    </HashRouter>
  </StrictMode>,
)
