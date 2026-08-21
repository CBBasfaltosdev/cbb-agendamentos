import { Link } from 'react-router-dom'
import logo from '../assets/logo-cbb.png'
import icone from '../assets/icone-cbb.png'
import { sair, type Colaborador } from '../lib/bookingService'
import './Header.css'

export default function Header({ colaborador, isAdmin }: { colaborador: Colaborador; isAdmin: boolean }) {
  return (
    <>
      <div className="faixa-marca" aria-hidden="true" />
      <header className="cabecalho">
        <Link to="/" className="logo-link" aria-label="Central de Agendamentos CBB — página inicial">
          <img src={logo} alt="CBB Asfaltos" className="logo-completo" />
          <img src={icone} alt="CBB Asfaltos" className="logo-compacto" />
        </Link>
        <div className="area-colaborador">
          {isAdmin && (
            <Link to="/admin" className="link-painel">
              Painel
            </Link>
          )}
          <Link to="/meus-agendamentos" className="link-painel">
            Meus agendamentos
          </Link>
          <span className="nome-colaborador">{colaborador.nome || colaborador.email}</span>
          <button type="button" className="botao-sair" onClick={() => sair()}>
            Sair
          </button>
        </div>
      </header>
    </>
  )
}
