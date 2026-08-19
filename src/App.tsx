import { HashRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import EventoPage from './pages/EventoPage'
import './App.css'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/evento/:slug" element={<EventoPage />} />
      </Routes>
    </HashRouter>
  )
}

export default App
