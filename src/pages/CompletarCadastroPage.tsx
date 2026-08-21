import { useState } from 'react'
import { salvarCadastro } from '../lib/bookingService'
import logo from '../assets/logo-cbb.png'

// Aparece só quando o colaborador clicou no link de confirmação num navegador/aparelho
// diferente de onde preencheu o formulário — o e-mail já está verificado, só falta
// nome e matrícula, que não puderam ser recuperados do outro navegador.
export default function CompletarCadastroPage({ onConcluido }: { onConcluido: () => void }) {
  const [nome, setNome] = useState('')
  const [matricula, setMatricula] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault()
    setErro(null)

    if (!nome.trim() || !matricula.trim()) {
      setErro('Preencha nome e matrícula.')
      return
    }

    setEnviando(true)
    try {
      await salvarCadastro({ nome, matricula })
      onConcluido()
    } catch (e) {
      setErro('Não foi possível salvar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="pagina-login">
      <div className="cartao-login">
        <img src={logo} alt="CBB Asfaltos" className="logo-login" />
        <form onSubmit={enviar}>
          <h1>Complete seu cadastro</h1>
          <p className="subtitulo">Seu e-mail já foi confirmado. Falta só nome e matrícula.</p>
          <label>
            Nome completo
            <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </label>
          <label>
            Matrícula
            <input value={matricula} onChange={(e) => setMatricula(e.target.value)} />
          </label>
          {erro && <p className="mensagem erro">{erro}</p>}
          <button type="submit" className="botao-primario botao-bloco" disabled={enviando}>
            {enviando ? 'Salvando…' : 'Continuar'}
          </button>
        </form>
      </div>
    </div>
  )
}
