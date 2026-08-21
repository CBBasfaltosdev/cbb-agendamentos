import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import {
  listarEventosAtivos,
  listarHorarios,
  minhasReservas,
  criarAgendamento,
  trocarHorario,
  type Evento,
  type Horario,
  type Periodo,
  type MinhaReserva,
} from '../lib/bookingService'

type Etapa = 'lista' | 'revisao' | 'sucesso'

const ROTULO_PERIODO: Record<Periodo, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
}

function formatarHora(hora: string) {
  return hora.slice(0, 5)
}

function formatarDataCompleta(data: string) {
  return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function EventoPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const trocarId = searchParams.get('trocar')

  const [evento, setEvento] = useState<Evento | null>(null)
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [minhasReservasEvento, setMinhasReservasEvento] = useState<MinhaReserva[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null)
  const [periodoAtivo, setPeriodoAtivo] = useState<Periodo | null>(null)
  const [erroPagina, setErroPagina] = useState<string | null>(null)

  const [horarioSelecionado, setHorarioSelecionado] = useState<Horario | null>(null)
  const [etapa, setEtapa] = useState<Etapa>('lista')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const tituloModalRef = useRef<HTMLHeadingElement>(null)

  async function carregar() {
    if (!slug) return
    setCarregando(true)
    setErroCarregamento(null)
    try {
      const [eventos, listaHorarios, reservas] = await Promise.all([
        listarEventosAtivos(),
        listarHorarios(slug),
        minhasReservas(slug),
      ])
      const encontrado = eventos.find((e) => e.slug === slug) ?? null
      setEvento(encontrado)
      setHorarios(listaHorarios)
      setMinhasReservasEvento(reservas)
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

  useEffect(() => {
    if (etapa !== 'lista') tituloModalRef.current?.focus()
  }, [etapa])

  useEffect(() => {
    if (etapa === 'lista') return
    function aoTeclar(ev: KeyboardEvent) {
      if (ev.key === 'Escape' && !enviando) fecharFluxo()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, enviando])

  const periodos = useMemo(() => {
    const vagasPorPeriodo = new Map<Periodo, number>()
    for (const h of horarios) {
      vagasPorPeriodo.set(h.periodo, (vagasPorPeriodo.get(h.periodo) ?? 0) + h.vagasLivres)
    }
    const presentes = new Set(horarios.map((h) => h.periodo))
    return (['manha', 'tarde', 'noite'] as Periodo[])
      .filter((p) => presentes.has(p))
      .map((p) => ({ periodo: p, vagas: vagasPorPeriodo.get(p) ?? 0 }))
  }, [horarios])

  useEffect(() => {
    if (periodoAtivo || periodos.length === 0) return
    const melhor = periodos.reduce((a, b) => (b.vagas > a.vagas ? b : a))
    setPeriodoAtivo(melhor.periodo)
  }, [periodos, periodoAtivo])

  const horariosDoPeriodo = useMemo(
    () => horarios.filter((h) => h.periodo === periodoAtivo),
    [horarios, periodoAtivo]
  )

  const horariosLivres = horariosDoPeriodo.filter((h) => h.vagasLivres > 0)
  const horariosEsgotados = horariosDoPeriodo.filter((h) => h.vagasLivres === 0)

  function minhaReservaNoHorario(inicio: string): MinhaReserva | undefined {
    return minhasReservasEvento.find((r) => r.inicio === inicio)
  }

  function abrirReserva(horario: Horario) {
    if (horario.vagasLivres === 0) return
    setErroPagina(null)
    setErro(null)
    setHorarioSelecionado(horario)
    setEtapa('revisao')
  }

  function fecharFluxo() {
    setHorarioSelecionado(null)
    setEtapa('lista')
    setErro(null)
    if (trocarId) navigate(`/evento/${slug}`, { replace: true })
  }

  async function confirmarReserva() {
    if (!horarioSelecionado) return
    setErro(null)
    setEnviando(true)

    try {
      const resultado = trocarId
        ? await trocarHorario(trocarId, horarioSelecionado.slotIdsLivres)
        : await criarAgendamento(horarioSelecionado.slotIdsLivres)

      if (!resultado.ok) {
        if (resultado.motivo === 'sem_vaga') {
          setErroPagina(`O horário das ${formatarHora(horarioSelecionado.inicio)} acabou de ser preenchido por outra pessoa. Escolha outro horário abaixo.`)
          await carregar()
          setEtapa('lista')
          setHorarioSelecionado(null)
        } else if (resultado.motivo === 'nao_autenticado') {
          setErroPagina('Sua sessão expirou. Recarregue a página e entre novamente.')
        } else {
          setErro('Não foi possível concluir. Tente novamente em alguns segundos.')
        }
        return
      }

      setEtapa('sucesso')
      await carregar()
    } catch (e) {
      setErro('Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  if (carregando) return <p className="mensagem">Carregando horários…</p>
  if (erroCarregamento) return <p className="mensagem erro">{erroCarregamento}</p>
  if (!evento) return <p className="mensagem">Evento não encontrado. <Link to="/">Voltar</Link></p>

  const reservaEmTroca = trocarId ? minhasReservasEvento.find((r) => r.id === trocarId) : null

  return (
    <div className="pagina-evento">
      <Link to="/" className="voltar">← Todos os agendamentos</Link>
      <h1>{evento.nome}</h1>
      {evento.descricao && <p className="descricao">{evento.descricao}</p>}
      <p className="data-evento">Dia {new Date(evento.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')}</p>

      {erroPagina && (
        <p className="alerta-pagina erro" role="status" aria-live="polite">
          {erroPagina}
        </p>
      )}

      {trocarId && (
        <p className="alerta-pagina" style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}>
          Escolha o novo horário para trocar sua reserva{reservaEmTroca ? ` das ${formatarHora(reservaEmTroca.inicio)}` : ''}.
        </p>
      )}

      {periodos.length === 0 && (
        <p className="estado-vazio">Os horários deste evento ainda não foram abertos. Avisaremos quando estiverem disponíveis.</p>
      )}

      {periodos.length > 0 && (
        <>
          <div className="chips-periodo" role="tablist" aria-label="Período do dia">
            {periodos.map(({ periodo, vagas }) => (
              <button
                key={periodo}
                type="button"
                role="tab"
                aria-selected={periodoAtivo === periodo}
                className={`chip ${periodoAtivo === periodo ? 'chip-ativo' : ''} ${vagas === 0 ? 'chip-esgotado' : ''}`}
                onClick={() => setPeriodoAtivo(periodo)}
              >
                {ROTULO_PERIODO[periodo]}{' '}
                <span className="chip-contagem">{vagas === 0 ? 'Esgotado' : vagas}</span>
              </button>
            ))}
          </div>

          <h2 className="titulo-secao">Escolha seu horário</h2>

          {horariosDoPeriodo.length === 0 && (
            <p className="estado-vazio">
              Nenhum horário nesse período. Veja outro período acima.
            </p>
          )}

          {horariosDoPeriodo.length > 0 && (
            <ul className="lista-horarios">
              {horariosLivres.map((h) => {
                const minha = minhaReservaNoHorario(h.inicio)
                if (minha && !trocarId) {
                  return (
                    <li key={h.inicio}>
                      <div className="linha-horario minha-reserva" aria-label={`Você já reservou ${formatarHora(h.inicio)}`}>
                        <span className="hora">{formatarHora(h.inicio)}</span>
                        <span className="status-horario">Reservado por você</span>
                        <span className="selo-minha-reserva">Sua reserva</span>
                      </div>
                    </li>
                  )
                }
                return (
                  <li key={h.inicio}>
                    <button type="button" className="linha-horario" onClick={() => abrirReserva(h)}>
                      <span className="hora">{formatarHora(h.inicio)}</span>
                      <span className="status-horario">
                        {h.vagasLivres} {h.vagasLivres === 1 ? 'vaga' : 'vagas'}
                      </span>
                      <span className="acao-reservar">{trocarId ? 'Trocar para cá' : 'Reservar'}</span>
                    </button>
                  </li>
                )
              })}

              {horariosEsgotados.map((h) => (
                <li key={h.inicio}>
                  <div className="linha-horario indisponivel" aria-disabled="true">
                    <span className="hora">{formatarHora(h.inicio)}</span>
                    <span className="status-horario">Indisponível</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {horarioSelecionado && etapa !== 'lista' && (
        <div
          className="modal-fundo"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-reserva"
          onClick={() => !enviando && fecharFluxo()}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {etapa === 'revisao' && (
              <div>
                <p className="passo">Revisão</p>
                <h2 id="titulo-modal-reserva" tabIndex={-1} ref={tituloModalRef}>
                  {trocarId ? 'Revise a troca de horário' : 'Revise sua reserva'}
                </h2>
                <dl className="resumo-reserva">
                  <dt>Evento</dt>
                  <dd>{evento.nome}</dd>
                  <dt>Data</dt>
                  <dd>{formatarDataCompleta(evento.dataInicio)}</dd>
                  <dt>Horário</dt>
                  <dd>{formatarHora(horarioSelecionado.inicio)} às {formatarHora(horarioSelecionado.fim)}</dd>
                </dl>
                {!trocarId && minhasReservasEvento.length > 0 && (
                  <p className="aviso-modal">
                    Você já tem o horário das {formatarHora(minhasReservasEvento[0].inicio)} reservado neste evento. Esta será mais uma reserva sua.
                  </p>
                )}
                {erro && <p className="mensagem erro">{erro}</p>}
                <div className="acoes-modal">
                  <button type="button" className="botao-texto" onClick={fecharFluxo} disabled={enviando}>
                    Voltar
                  </button>
                  <button type="button" className="botao-primario" onClick={confirmarReserva} disabled={enviando}>
                    {enviando ? 'Enviando…' : `${trocarId ? 'Trocar para' : 'Reservar'} ${formatarHora(horarioSelecionado.inicio)}`}
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
                <h2 id="titulo-modal-reserva" tabIndex={-1} ref={tituloModalRef}>
                  {trocarId ? 'Horário trocado' : 'Agendamento confirmado'}
                </h2>
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
