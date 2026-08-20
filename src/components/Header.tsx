import { Link } from 'react-router-dom'
import logo from '../assets/logo-cbb.png'
import icone from '../assets/icone-cbb.png'
import './Header.css'

export default function Header() {
  return (
    <>
      <div className="faixa-marca" aria-hidden="true" />
      <header className="cabecalho">
        <Link to="/" className="logo-link" aria-label="Central de Agendamentos CBB — página inicial">
          <img src={logo} alt="CBB Asfaltos" className="logo-completo" />
          <img src={icone} alt="CBB Asfaltos" className="logo-compacto" />
        </Link>
      </header>
    </>
  )
}
