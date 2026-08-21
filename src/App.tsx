import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import HomePage from './pages/HomePage'
import EventoPage from './pages/EventoPage'
import LoginPage from './pages/LoginPage'
import CompletarCadastroPage from './pages/CompletarCadastroPage'
import { supabase } from './lib/supabaseClient'
import { colaboradorAutenticado, aplicarCadastroPendente, type Colaborador } from './lib/bookingService'
import './App.css'

function App() {
  const [colaborador, setColaborador] = useState<Colaborador | null | undefined>(undefined)

  async function atualizarSessao() {
    await aplicarCadastroPendente()
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
    return <LoginPage />
  }

  if (!colaborador.nome) {
    return <CompletarCadastroPage onConcluido={atualizarSessao} />
  }

  return (
    <BrowserRouter basename="/cbb-agendamentos">
      <Header colaborador={colaborador} />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/evento/:slug" element={<EventoPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App
