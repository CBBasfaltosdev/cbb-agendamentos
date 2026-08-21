import { useState } from 'react'
import { emailValido, iniciarLogin } from '../lib/bookingService'
import logo from '../assets/logo-cbb.png'

export default function LoginPage() {
  const [nome, setNome] = useState('')
  const [matricula, setMatricula] = useState('')
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [linkEnviado, setLinkEnviado] = useState(false)

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault()
    setErro(null)

    if (!nome.trim() || !matricula.trim()) {
      setErro('Preencha nome e matrícula.')
      return
    }
    if (!emailValido(email)) {
      setErro('Use seu e-mail corporativo (@cbbasfaltos.com.br).')
      return
    }

    setEnviando(true)
    try {
      await iniciarLogin({ nome, matricula, email })
      setLinkEnviado(true)
    } catch (e) {
      setErro('Não foi possível enviar o e-mail de confirmação. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="pagina-login">
      <div className="cartao-login">
        <img src={logo} alt="CBB Asfaltos" className="logo-login" />

        {!linkEnviado && (
          <form onSubmit={enviar}>
            <h1>Entrar</h1>
            <p className="subtitulo">
              Use seu nome, matrícula e e-mail corporativo para acessar os agendamentos.
            </p>
            <label>
              Nome completo
              <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
            </label>
            <label>
              Matrícula
              <input value={matricula} onChange={(e) => setMatricula(e.target.value)} />
            </label>
            <label>
              E-mail corporativo
              <input
                type="email"
                placeholder="nome.sobrenome@cbbasfaltos.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {erro && <p className="mensagem erro">{erro}</p>}
            <button type="submit" className="botao-primario botao-bloco" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar link de acesso'}
            </button>
          </form>
        )}

        {linkEnviado && (
          <div>
            <h1>Verifique seu e-mail</h1>
            <p className="subtitulo">
              Enviamos um link de acesso para <strong>{email}</strong>. Abra o e-mail e clique em
              "Confirm email address" para entrar — você volta automaticamente para esta página,
              já autenticado.
            </p>
            <p className="subtitulo" style={{ marginTop: 16 }}>
              Não recebeu? Confira a caixa de spam ou{' '}
              <button type="button" className="botao-texto" style={{ padding: 0 }} onClick={() => setLinkEnviado(false)}>
                tente novamente
              </button>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
