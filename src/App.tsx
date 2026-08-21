import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header'
import HomePage from './pages/HomePage'
import EventoPage from './pages/EventoPage'
import LoginPage from './pages/LoginPage'
import CompletarCadastroPage from './pages/CompletarCadastroPage'
import AdminPage from './pages/AdminPage'
import MeusAgendamentosPage from './pages/MeusAgendamentosPage'
import { supabase } from './lib/supabaseClient'
import { colaboradorAutenticado, aplicarCadastroPendente, souAdmin, type Colaborador } from './lib/bookingService'
import './App.css'

function App() {
  const [colaborador, setColaborador] = useState<Colaborador | null | undefined>(undefined)
  const [isAdmin, setIsAdmin] = useState(false)

  async function atualizarSessao() {
    try {
      await aplicarCadastroPendente()
    } catch (e) {
      // Rede instável logo após o clique no link de confirmação não pode travar a tela
      // em "Carregando…" para sempre — se falhar, CompletarCadastroPage pede o nome de novo.
    }
    const atual = await colaboradorAutenticado()
    setColaborador(atual)
    setIsAdmin(atual ? await souAdmin() : false)
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
      <Header colaborador={colaborador} isAdmin={isAdmin} />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/evento/:slug" element={<EventoPage />} />
          <Route path="/meus-agendamentos" element={<MeusAgendamentosPage />} />
          <Route path="/admin" element={isAdmin ? <AdminPage /> : <Navigate to="/" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App
