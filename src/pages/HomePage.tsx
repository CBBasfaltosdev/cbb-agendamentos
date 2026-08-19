import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarEventosAtivos, type Evento } from '../lib/bookingService'

export default function HomePage() {
  const [eventos, setEventos] = useState<Evento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    listarEventosAtivos()
      .then(setEventos)
      .catch(() => setErro('Não foi possível carregar os agendamentos disponíveis.'))
      .finally(() => setCarregando(false))
  }, [])

  return (
    <div className="pagina-home">
      <h1>Central de Agendamentos CBB</h1>
      <p className="subtitulo">Escolha um evento para reservar seu horário.</p>

      {carregando && <p className="mensagem">Carregando…</p>}
      {erro && <p className="mensagem erro">{erro}</p>}

      {!carregando && !erro && eventos.length === 0 && (
        <p className="mensagem">Nenhum agendamento disponível no momento.</p>
      )}

      <div className="lista-eventos">
        {eventos.map((e) => (
          <Link key={e.slug} to={`/evento/${e.slug}`} className="card-evento">
            <h2>{e.nome}</h2>
            {e.descricao && <p>{e.descricao}</p>}
            <span className="data-card">
              {new Date(e.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
