import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarTodosAgendamentos, cancelarAgendamentoAdmin, type AgendamentoAdmin } from '../lib/bookingService'

function formatarData(data: string) {
  if (!data) return '—'
  return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR')
}

function formatarHora(hora: string) {
  return hora ? hora.slice(0, 5) : '—'
}

export default function AdminPage() {
  const [agendamentos, setAgendamentos] = useState<AgendamentoAdmin[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('')
  const [cancelandoId, setCancelandoId] = useState<string | null>(null)

  function carregar() {
    setCarregando(true)
    setErro(null)
    listarTodosAgendamentos()
      .then(setAgendamentos)
      .catch(() => setErro('Não foi possível carregar os agendamentos.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => {
    carregar()
  }, [])

  const confirmados = useMemo(() => agendamentos.filter((a) => a.status === 'confirmado'), [agendamentos])

  const filtrados = useMemo(() => {
    const termo = filtro.trim().toLowerCase()
    if (!termo) return confirmados
    return confirmados.filter(
      (a) =>
        a.nome.toLowerCase().includes(termo) ||
        (a.email ?? '').toLowerCase().includes(termo) ||
        (a.setor ?? '').toLowerCase().includes(termo)
    )
  }, [confirmados, filtro])

  async function cancelar(id: string) {
    const ok = window.confirm('Cancelar este agendamento? O horário volta a ficar disponível.')
    if (!ok) return

    setCancelandoId(id)
    try {
      await cancelarAgendamentoAdmin(id)
      carregar()
    } catch (e) {
      setErro('Não foi possível cancelar. Tente novamente.')
    } finally {
      setCancelandoId(null)
    }
  }

  return (
    <div className="pagina-evento">
      <Link to="/" className="voltar">← Central de Agendamentos</Link>
      <h1>Painel administrativo</h1>
      <p className="descricao">Todos os agendamentos confirmados, mais recentes primeiro.</p>

      {carregando && <p className="mensagem">Carregando…</p>}
      {erro && <p className="mensagem erro">{erro}</p>}

      {!carregando && !erro && (
        <>
          <p className="data-evento">{confirmados.length} confirmados</p>

          <label className="campo-busca">
            Buscar por nome, e-mail ou setor
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar…" />
          </label>

          <div className="tabela-scroll">
            <table className="tabela-admin">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Setor</th>
                  <th>Evento</th>
                  <th>Data</th>
                  <th>Horário</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((a) => (
                  <tr key={a.id}>
                    <td>{a.nome}</td>
                    <td>{a.email ?? '—'}</td>
                    <td>{a.setor ?? '—'}</td>
                    <td>{a.eventoNome}</td>
                    <td>{formatarData(a.data)}</td>
                    <td>{formatarHora(a.inicio)}</td>
                    <td>
                      <button
                        type="button"
                        className="botao-texto-perigo"
                        onClick={() => cancelar(a.id)}
                        disabled={cancelandoId === a.id}
                      >
                        {cancelandoId === a.id ? 'Cancelando…' : 'Cancelar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtrados.length === 0 && <p className="estado-vazio">Nenhum agendamento encontrado.</p>}
          </div>
        </>
      )}
    </div>
  )
}
