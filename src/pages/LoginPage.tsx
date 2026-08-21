import { useState } from 'react'
import { emailValido, iniciarLogin, entrarComoAdmin } from '../lib/bookingService'
import logo from '../assets/logo-cbb.png'

type Modo = 'colaborador' | 'admin'

export default function LoginPage() {
  const [modo, setModo] = useState<Modo>('colaborador')

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [linkEnviado, setLinkEnviado] = useState(false)

  const [emailAdmin, setEmailAdmin] = useState('')
  const [senhaAdmin, setSenhaAdmin] = useState('')
  const [erroAdmin, setErroAdmin] = useState<string | null>(null)
  const [enviandoAdmin, setEnviandoAdmin] = useState(false)

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault()
    setErro(null)

    if (!nome.trim()) {
      setErro('Preencha seu nome.')
      return
    }
    if (!emailValido(email)) {
      setErro('Use seu e-mail corporativo (@cbbasfaltos.com.br).')
      return
    }

    setEnviando(true)
    try {
      await iniciarLogin({ nome, email })
      setLinkEnviado(true)
    } catch (e) {
      setErro('Não foi possível enviar o e-mail de confirmação. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  async function entrarAdmin(ev: React.FormEvent) {
    ev.preventDefault()
    setErroAdmin(null)

    if (!emailAdmin.trim() || !senhaAdmin) {
      setErroAdmin('Preencha e-mail e senha.')
      return
    }

    setEnviandoAdmin(true)
    try {
      await entrarComoAdmin(emailAdmin, senhaAdmin)
    } catch (e) {
      setErroAdmin('E-mail ou senha incorretos.')
    } finally {
      setEnviandoAdmin(false)
    }
  }

  return (
    <div className="pagina-login">
      <div className="cartao-login">
        <img src={logo} alt="CBB Asfaltos" className="logo-login" width={1128} height={500} />

        {modo === 'colaborador' && !linkEnviado && (
          <form onSubmit={enviar}>
            <h1>Entrar</h1>
            <p className="subtitulo">
              Use seu nome e e-mail corporativo para acessar os agendamentos.
            </p>
            <label>
              Nome completo
              <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
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
            <button
              type="button"
              className="botao-texto botao-bloco-centro"
              onClick={() => setModo('admin')}
            >
              Entrar como administrador
            </button>
          </form>
        )}

        {modo === 'colaborador' && linkEnviado && (
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

        {modo === 'admin' && (
          <form onSubmit={entrarAdmin}>
            <h1>Acesso administrativo</h1>
            <p className="subtitulo">Entre com o e-mail e a senha de administração dos agendamentos.</p>
            <label>
              E-mail
              <input
                type="email"
                value={emailAdmin}
                onChange={(e) => setEmailAdmin(e.target.value)}
                autoFocus
              />
            </label>
            <label>
              Senha
              <input type="password" value={senhaAdmin} onChange={(e) => setSenhaAdmin(e.target.value)} />
            </label>
            {erroAdmin && <p className="mensagem erro">{erroAdmin}</p>}
            <button type="submit" className="botao-primario botao-bloco" disabled={enviandoAdmin}>
              {enviandoAdmin ? 'Entrando…' : 'Entrar'}
            </button>
            <button
              type="button"
              className="botao-texto botao-bloco-centro"
              onClick={() => setModo('colaborador')}
            >
              ← Voltar para o login de colaborador
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
