import { useEffect, useRef, useState } from 'react'
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
import { AdminProvider } from './contexts/AdminContext'
import './App.css'

function App() {
  const [colaborador, setColaborador] = useState<Colaborador | null | undefined>(undefined)
  const [isAdmin, setIsAdmin] = useState(false)

  // Supabase dispara onAuthStateChange várias vezes (INITIAL_SESSION, TOKEN_REFRESHED, sign
  // in/out) — se duas chamadas ficarem em voo ao mesmo tempo, só a mais recente pode aplicar
  // o resultado, senão uma resposta mais lenta e desatualizada sobrescreve o estado certo.
  const chamadaAtualRef = useRef(0)

  async function atualizarSessao() {
    const chamada = ++chamadaAtualRef.current
    try {
      await aplicarCadastroPendente()
    } catch (e) {
      // Rede instável logo após o clique no link de confirmação não pode travar a tela
      // em "Carregando…" para sempre — se falhar, CompletarCadastroPage pede o nome de novo.
    }
    const atual = await colaboradorAutenticado()
    const admin = atual ? await souAdmin() : false
    if (chamada !== chamadaAtualRef.current) return
    setColaborador(atual)
    setIsAdmin(admin)
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
    <AdminProvider value={isAdmin}>
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
    </AdminProvider>
  )
}

export default App
