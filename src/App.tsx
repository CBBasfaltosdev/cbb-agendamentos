import { HashRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import HomePage from './pages/HomePage'
import EventoPage from './pages/EventoPage'
import './App.css'

function App() {
  return (
    <HashRouter>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/evento/:slug" element={<EventoPage />} />
        </Routes>
      </main>
    </HashRouter>
  )
}

export default App
