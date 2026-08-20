import { useState } from 'react'
import { emailValido, enviarCodigoConfirmacao, confirmarCodigo } from '../lib/bookingService'
import logo from '../assets/logo-cbb.png'

type Etapa = 'dados' | 'codigo'

export default function LoginPage({ onAutenticado }: { onAutenticado: () => void }) {
  const [etapa, setEtapa] = useState<Etapa>('dados')
  const [nome, setNome] = useState('')
  const [matricula, setMatricula] = useState('')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviarDados(ev: React.FormEvent) {
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
      await enviarCodigoConfirmacao(email)
      setEtapa('codigo')
    } catch (e) {
      setErro('Não foi possível enviar o código. Confira o e-mail e tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  async function confirmar(ev: React.FormEvent) {
    ev.preventDefault()
    setErro(null)

    if (!codigo.trim()) {
      setErro('Digite o código recebido por e-mail.')
      return
    }

    setEnviando(true)
    try {
      await confirmarCodigo(email, codigo, { nome, matricula })
      onAutenticado()
    } catch (e) {
      setErro('Código inválido ou expirado. Solicite um novo código.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="pagina-login">
      <div className="cartao-login">
        <img src={logo} alt="CBB Asfaltos" className="logo-login" />

        {etapa === 'dados' && (
          <form onSubmit={enviarDados}>
            <p className="passo">Passo 1 de 2 · Identificação</p>
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
              {enviando ? 'Enviando…' : 'Enviar código de confirmação'}
            </button>
          </form>
        )}

        {etapa === 'codigo' && (
          <form onSubmit={confirmar}>
            <p className="passo">Passo 2 de 2 · Código de confirmação</p>
            <h1>Digite o código</h1>
            <p className="subtitulo">Enviamos um código de confirmação para {email}.</p>
            <label>
              Código
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)} autoFocus />
            </label>
            {erro && <p className="mensagem erro">{erro}</p>}
            <div className="acoes-login">
              <button type="button" className="botao-texto" onClick={() => setEtapa('dados')} disabled={enviando}>
                Voltar
              </button>
              <button type="submit" className="botao-primario" disabled={enviando}>
                {enviando ? 'Confirmando…' : 'Entrar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
