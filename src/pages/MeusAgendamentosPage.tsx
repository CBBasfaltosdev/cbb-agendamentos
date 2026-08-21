import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  minhasReservasTodas,
  cancelarAgendamento,
  salvarCadastro,
  colaboradorAutenticado,
  type MinhaReservaTodas,
  type Colaborador,
} from '../lib/bookingService'

function formatarData(data: string) {
  return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  })
}

function formatarHora(hora: string) {
  return hora.slice(0, 5)
}

export default function MeusAgendamentosPage() {
  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  const [reservas, setReservas] = useState<MinhaReservaTodas[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [cancelandoId, setCancelandoId] = useState<string | null>(null)

  const [editandoNome, setEditandoNome] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [salvandoNome, setSalvandoNome] = useState(false)

  async function carregar() {
    setCarregando(true)
    setErro(null)
    try {
      const [c, r] = await Promise.all([colaboradorAutenticado(), minhasReservasTodas()])
      setColaborador(c)
      setReservas(r)
      setNovoNome(c?.nome ?? '')
    } catch (e) {
      setErro('Não foi possível carregar seus agendamentos.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  async function confirmarCancelamento(id: string) {
    const ok = window.confirm('Cancelar esta reserva? O horário volta a ficar disponível para outros colaboradores.')
    if (!ok) return

    setCancelandoId(id)
    try {
      await cancelarAgendamento(id)
      await carregar()
    } catch (e) {
      setErro('Não foi possível cancelar. Tente novamente.')
    } finally {
      setCancelandoId(null)
    }
  }

  async function salvarNome(ev: React.FormEvent) {
    ev.preventDefault()
    if (!novoNome.trim()) return

    setSalvandoNome(true)
    try {
      await salvarCadastro({ nome: novoNome })
      setEditandoNome(false)
      await carregar()
    } catch (e) {
      setErro('Não foi possível salvar o nome. Tente novamente.')
    } finally {
      setSalvandoNome(false)
    }
  }

  return (
    <div className="pagina-evento">
      <Link to="/" className="voltar">← Central de Agendamentos</Link>
      <h1>Meus agendamentos</h1>

      {colaborador && (
        <p className="descricao">
          {colaborador.email}
          {!editandoNome && (
            <>
              {' · '}
              {colaborador.nome}{' '}
              <button type="button" className="botao-texto" style={{ padding: 0 }} onClick={() => setEditandoNome(true)}>
                Editar nome
              </button>
            </>
          )}
        </p>
      )}

      {editandoNome && (
        <form onSubmit={salvarNome} className="form-editar-nome">
          <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} autoFocus />
          <button type="submit" className="botao-primario" disabled={salvandoNome}>
            {salvandoNome ? 'Salvando…' : 'Salvar'}
          </button>
          <button type="button" className="botao-texto" onClick={() => setEditandoNome(false)}>
            Cancelar
          </button>
        </form>
      )}

      {erro && <p className="alerta-pagina erro" role="status">{erro}</p>}
      {carregando && <p className="mensagem">Carregando…</p>}

      {!carregando && reservas.length === 0 && (
        <p className="estado-vazio">Você ainda não tem nenhum agendamento confirmado.</p>
      )}

      {!carregando && reservas.length > 0 && (
        <ul className="lista-horarios">
          {reservas.map((r) => (
            <li key={r.id}>
              <div className="linha-minha-reserva">
                <div>
                  <span className="hora">{formatarHora(r.inicio)}</span>
                  <span className="status-horario"> — {r.eventoNome}, {formatarData(r.data)}</span>
                </div>
                <div className="acoes-linha">
                  <Link to={`/evento/${r.eventoSlug}?trocar=${r.id}`} className="botao-texto">
                    Trocar horário
                  </Link>
                  <button
                    type="button"
                    className="botao-texto-perigo"
                    onClick={() => confirmarCancelamento(r.id)}
                    disabled={cancelandoId === r.id}
                  >
                    {cancelandoId === r.id ? 'Cancelando…' : 'Cancelar'}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
