import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import HomePage from './pages/HomePage'
import EventoPage from './pages/EventoPage'
import LoginPage from './pages/LoginPage'
import { supabase } from './lib/supabaseClient'
import { colaboradorAutenticado, type Colaborador } from './lib/bookingService'
import './App.css'

function App() {
  const [colaborador, setColaborador] = useState<Colaborador | null | undefined>(undefined)

  async function atualizarSessao() {
    setColaborador(await colaboradorAutenticado())
  }

  useEffect(() => {
    atualizarSessao()
    const { data: assinatura } = supabase.auth.onAuthStateChange(() => {
      atualizarSessao()
    })
    return () => assinatura.subscription.unsubscribe()
  }, [])

  if (colaborador === undefined) {
    return <p className="mensagem">Carregando…</p>
  }

  if (!colaborador) {
    return <LoginPage onAutenticado={atualizarSessao} />
  }

  return (
    <HashRouter>
      <Header colaborador={colaborador} />
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
