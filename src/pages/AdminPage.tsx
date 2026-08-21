import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarTodosAgendamentos, type AgendamentoAdmin } from '../lib/bookingService'

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

  useEffect(() => {
    listarTodosAgendamentos()
      .then(setAgendamentos)
      .catch(() => setErro('Não foi possível carregar os agendamentos.'))
      .finally(() => setCarregando(false))
  }, [])

  const confirmados = useMemo(() => agendamentos.filter((a) => a.status === 'confirmado'), [agendamentos])

  const filtrados = useMemo(() => {
    const termo = filtro.trim().toLowerCase()
    if (!termo) return confirmados
    return confirmados.filter(
      (a) => a.nome.toLowerCase().includes(termo) || a.email.toLowerCase().includes(termo)
    )
  }, [confirmados, filtro])

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
            Buscar por nome ou e-mail
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar…" />
          </label>

          <div className="tabela-scroll">
            <table className="tabela-admin">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Evento</th>
                  <th>Data</th>
                  <th>Horário</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((a) => (
                  <tr key={a.id}>
                    <td>{a.nome}</td>
                    <td>{a.email}</td>
                    <td>{a.eventoNome}</td>
                    <td>{formatarData(a.data)}</td>
                    <td>{formatarHora(a.inicio)}</td>
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
