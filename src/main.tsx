
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import Head from './components/Head';

createRoot(document.getElementById("root")!).render(
  <>
    <Head />
    <App />
  </>
);
