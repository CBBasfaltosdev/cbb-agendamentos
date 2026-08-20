import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  listarEventosAtivos,
  listarHorarios,
  criarAgendamento,
  meusAgendamentos,
  type Evento,
  type Horario,
  type Periodo,
} from '../lib/bookingService'

type Etapa = 'lista' | 'confirmar' | 'sucesso'

const ROTULO_PERIODO: Record<Periodo, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
}

function formatarHora(hora: string) {
  return hora.slice(0, 5)
}

export default function EventoPage() {
  const { slug } = useParams<{ slug: string }>()
  const [evento, setEvento] = useState<Evento | null>(null)
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null)
  const [periodoAtivo, setPeriodoAtivo] = useState<Periodo | null>(null)

  const [horarioSelecionado, setHorarioSelecionado] = useState<Horario | null>(null)
  const [etapa, setEtapa] = useState<Etapa>('lista')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function carregar() {
    if (!slug) return
    setCarregando(true)
    setErroCarregamento(null)
    try {
      const [eventos, listaHorarios] = await Promise.all([listarEventosAtivos(), listarHorarios(slug)])
      const encontrado = eventos.find((e) => e.slug === slug) ?? null
      setEvento(encontrado)
      setHorarios(listaHorarios)
    } catch (e) {
      setErroCarregamento('Não foi possível carregar os horários. Tente recarregar a página.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const periodos = useMemo(() => {
    const totais = new Map<Periodo, number>()
    for (const h of horarios) {
      totais.set(h.periodo, (totais.get(h.periodo) ?? 0) + 1)
    }
    return (['manha', 'tarde', 'noite'] as Periodo[])
      .filter((p) => totais.has(p))
      .map((p) => ({ periodo: p, total: totais.get(p)! }))
  }, [horarios])

  useEffect(() => {
    if (periodoAtivo || periodos.length === 0) return
    const comMaisVagas = [...horarios]
      .reduce<Record<string, number>>((acc, h) => {
        acc[h.periodo] = (acc[h.periodo] ?? 0) + h.vagasLivres
        return acc
      }, {})
    const melhor = periodos.reduce((a, b) => ((comMaisVagas[b.periodo] ?? 0) > (comMaisVagas[a.periodo] ?? 0) ? b : a))
    setPeriodoAtivo(melhor.periodo)
  }, [periodos, horarios, periodoAtivo])

  const horariosDoPeriodo = useMemo(
    () => horarios.filter((h) => h.periodo === periodoAtivo),
    [horarios, periodoAtivo]
  )

  async function abrirReserva(horario: Horario) {
    if (horario.vagasLivres === 0) return
    setErro(null)

    const existentes = await meusAgendamentos()
    if (existentes.length > 0) {
      const continuar = window.confirm(
        'Você já possui um agendamento neste evento. Como ainda há vagas, você pode reservar outro horário. Confirmar mesmo assim?'
      )
      if (!continuar) return
    }

    setHorarioSelecionado(horario)
    setEtapa('confirmar')
  }

  function fecharFluxo() {
    setHorarioSelecionado(null)
    setEtapa('lista')
    setErro(null)
  }

  async function confirmarReserva() {
    if (!horarioSelecionado) return
    setErro(null)
    setEnviando(true)

    try {
      const resultado = await criarAgendamento(horarioSelecionado.slotIdsLivres)

      if (!resultado.ok) {
        if (resultado.motivo === 'sem_vaga') {
          setErro('Esse horário acabou de lotar. Escolha outro horário.')
          await carregar()
          setEtapa('lista')
          setHorarioSelecionado(null)
        } else {
          setErro('Não foi possível confirmar o agendamento. Tente novamente.')
        }
        return
      }

      setEtapa('sucesso')
      await carregar()
    } finally {
      setEnviando(false)
    }
  }

  if (carregando) return <p className="mensagem">Carregando horários…</p>
  if (erroCarregamento) return <p className="mensagem erro">{erroCarregamento}</p>
  if (!evento) return <p className="mensagem">Evento não encontrado. <Link to="/">Voltar</Link></p>

  return (
    <div className="pagina-evento">
      <Link to="/" className="voltar">← Todos os agendamentos</Link>
      <h1>{evento.nome}</h1>
      {evento.descricao && <p className="descricao">{evento.descricao}</p>}
      <p className="data-evento">Dia {new Date(evento.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')}</p>

      <div className="chips-periodo" role="tablist" aria-label="Período do dia">
        {periodos.map(({ periodo, total }) => (
          <button
            key={periodo}
            type="button"
            role="tab"
            aria-selected={periodoAtivo === periodo}
            className={`chip ${periodoAtivo === periodo ? 'chip-ativo' : ''}`}
            onClick={() => setPeriodoAtivo(periodo)}
          >
            {ROTULO_PERIODO[periodo]} <span className="chip-contagem">{total}</span>
          </button>
        ))}
      </div>

      <p className="legenda">
        <span className="marcador marcador-livre" /> livre &nbsp;&nbsp;
        <span className="marcador marcador-indisponivel" /> indisponível
      </p>

      <ul className="lista-horarios">
        {horariosDoPeriodo.map((h) => {
          const indisponivel = h.vagasLivres === 0
          return (
            <li key={h.inicio}>
              <button
                type="button"
                className={`linha-horario ${indisponivel ? 'indisponivel' : ''}`}
                disabled={indisponivel}
                onClick={() => abrirReserva(h)}
                aria-disabled={indisponivel}
              >
                <span className="hora">{formatarHora(h.inicio)}</span>
                <span className="status-horario">
                  {indisponivel ? 'Indisponível' : `${h.vagasLivres} ${h.vagasLivres === 1 ? 'vaga' : 'vagas'}`}
                </span>
                {!indisponivel && <span className="acao-reservar">Reservar</span>}
              </button>
            </li>
          )
        })}
      </ul>

      {horarioSelecionado && etapa !== 'lista' && (
        <div className="modal-fundo" role="dialog" aria-modal="true">
          <div className="modal">
            {etapa === 'confirmar' && (
              <div>
                <h2>Confirmar horário</h2>
                <p className="resumo-horario">
                  {formatarHora(horarioSelecionado.inicio)} — {new Date(evento.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')}
                </p>
                {erro && <p className="mensagem erro">{erro}</p>}
                <div className="acoes-modal">
                  <button type="button" className="botao-texto" onClick={fecharFluxo} disabled={enviando}>
                    Cancelar
                  </button>
                  <button type="button" className="botao-primario" onClick={confirmarReserva} disabled={enviando}>
                    {enviando ? 'Confirmando…' : 'Confirmar agendamento'}
                  </button>
                </div>
              </div>
            )}

            {etapa === 'sucesso' && (
              <div>
                <div className="icone-sucesso" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2>Agendamento confirmado</h2>
                <p className="resumo-horario">
                  {formatarHora(horarioSelecionado.inicio)}, dia{' '}
                  {new Date(evento.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')}
                </p>
                <div className="acoes-modal">
                  <button type="button" className="botao-primario" onClick={fecharFluxo}>
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
