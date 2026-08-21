import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import {
  listarEventosAtivos,
  listarHorarios,
  minhasReservas,
  criarAgendamento,
  trocarHorario,
  cancelarAgendamento,
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

  const [cancelando, setCancelando] = useState<MinhaReserva | null>(null)
  const [erroCancelamento, setErroCancelamento] = useState<string | null>(null)
  const [cancelandoEnviando, setCancelandoEnviando] = useState(false)

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
    const horariosLivresPorPeriodo = new Map<Periodo, number>()
    for (const h of horarios) {
      if (h.vagasLivres === 0) continue
      horariosLivresPorPeriodo.set(h.periodo, (horariosLivresPorPeriodo.get(h.periodo) ?? 0) + 1)
    }
    const presentes = new Set(horarios.map((h) => h.periodo))
    return (['manha', 'tarde', 'noite'] as Periodo[])
      .filter((p) => presentes.has(p))
      .map((p) => ({ periodo: p, horariosLivres: horariosLivresPorPeriodo.get(p) ?? 0 }))
  }, [horarios])

  useEffect(() => {
    if (periodoAtivo || periodos.length === 0) return
    const melhor = periodos.reduce((a, b) => (b.horariosLivres > a.horariosLivres ? b : a))
    setPeriodoAtivo(melhor.periodo)
  }, [periodos, periodoAtivo])

  // Já vem ordenado por horário (listarHorarios ordena por inicio) — manter cronológico,
  // não separar livre/esgotado em listas diferentes, senão a ordem do dia vira sopa de letra.
  const horariosDoPeriodo = useMemo(
    () => horarios.filter((h) => h.periodo === periodoAtivo),
    [horarios, periodoAtivo]
  )

  const duracaoMin = useMemo(() => {
    const h = horarios[0]
    if (!h) return null
    const [hi, mi] = h.inicio.split(':').map(Number)
    const [hf, mf] = h.fim.split(':').map(Number)
    return hf * 60 + mf - (hi * 60 + mi)
  }, [horarios])

  function minhaReservaNoHorario(inicio: string): MinhaReserva | undefined {
    return minhasReservasEvento.find((r) => r.inicio === inicio)
  }

  // Regra de produto: 1 reserva confirmada por pessoa, por evento (reforçada também no
  // banco via trigger — isto aqui só evita nem abrir o fluxo de reservar outra).
  const jaTenhoReservaNoEvento = minhasReservasEvento.length > 0

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

  function abrirCancelamento(reserva: MinhaReserva) {
    setErroPagina(null)
    setErroCancelamento(null)
    setCancelando(reserva)
  }

  async function confirmarCancelamento() {
    if (!cancelando) return
    setErroCancelamento(null)
    setCancelandoEnviando(true)
    try {
      await cancelarAgendamento(cancelando.id)
      setCancelando(null)
      await carregar()
    } catch (e) {
      setErroCancelamento('Não foi possível cancelar. Tente novamente.')
    } finally {
      setCancelandoEnviando(false)
    }
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
        } else if (resultado.motivo === 'ja_reservado') {
          setErroPagina('Você já tem uma reserva confirmada neste evento. Cancele a atual para escolher outro horário.')
          await carregar()
          setEtapa('lista')
          setHorarioSelecionado(null)
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
          <div className="chips-periodo" role="group" aria-label="Período do dia">
            {periodos.map(({ periodo, horariosLivres }) => (
              <button
                key={periodo}
                type="button"
                aria-pressed={periodoAtivo === periodo}
                aria-label={`${ROTULO_PERIODO[periodo]}, ${horariosLivres === 0 ? 'esgotado' : `${horariosLivres} horários livres`}`}
                className={`chip ${periodoAtivo === periodo ? 'chip-ativo' : ''} ${horariosLivres === 0 ? 'chip-esgotado' : ''}`}
                onClick={() => setPeriodoAtivo(periodo)}
              >
                {ROTULO_PERIODO[periodo]}{' '}
                <span className="chip-contagem">{horariosLivres === 0 ? 'Esgotado' : horariosLivres}</span>
              </button>
            ))}
          </div>

          <h2 className="titulo-secao">Escolha seu horário</h2>
          {periodoAtivo && (
            <p className="ajuda-secao">
              {jaTenhoReservaNoEvento && !trocarId
                ? 'Você já tem uma reserva neste evento — toque nela na grade para cancelar.'
                : (periodos.find((p) => p.periodo === periodoAtivo)?.horariosLivres ?? 0) === 0
                  ? `Nenhum horário livre ${periodoAtivo === 'manha' ? 'pela manhã' : periodoAtivo === 'tarde' ? 'à tarde' : 'à noite'} — veja outro período acima.`
                  : `${periodos.find((p) => p.periodo === periodoAtivo)?.horariosLivres} horários livres${duracaoMin ? ` · sessões de ${duracaoMin} min` : ''}`}
            </p>
          )}

          {horariosDoPeriodo.length > 0 && (
            <>
              <div className="grade-horarios" role="group" aria-label={`Horários de ${ROTULO_PERIODO[periodoAtivo ?? 'manha']}`}>
                {horariosDoPeriodo.map((h) => {
                  const minha = minhaReservaNoHorario(h.inicio)
                  const ehMinhaSemTroca = minha && !trocarId
                  const esgotado = h.vagasLivres === 0 && !ehMinhaSemTroca
                  const bloqueadoPorLimite = jaTenhoReservaNoEvento && !trocarId && !esgotado && !ehMinhaSemTroca
                  const ultimaVaga = h.vagasLivres === 1 && !ehMinhaSemTroca && !bloqueadoPorLimite

                  if (ehMinhaSemTroca) {
                    return (
                      <button
                        key={h.inicio}
                        type="button"
                        className="slot slot-minha"
                        onClick={() => abrirCancelamento(minha!)}
                        aria-label={`Cancelar sua reserva das ${formatarHora(h.inicio)}`}
                      >
                        <span className="slot-hora">{formatarHora(h.inicio)}</span>
                        <span className="slot-nota">sua reserva</span>
                      </button>
                    )
                  }

                  if (esgotado || bloqueadoPorLimite) {
                    return (
                      <button
                        key={h.inicio}
                        type="button"
                        className="slot slot-esgotado"
                        disabled
                        aria-label={
                          esgotado
                            ? `${formatarHora(h.inicio)}, esgotado`
                            : `${formatarHora(h.inicio)}, indisponível — você já tem uma reserva neste evento`
                        }
                      >
                        <span className="slot-hora">{formatarHora(h.inicio)}</span>
                      </button>
                    )
                  }

                  return (
                    <button
                      key={h.inicio}
                      type="button"
                      className={`slot ${ultimaVaga ? 'slot-ultima' : ''}`}
                      onClick={() => abrirReserva(h)}
                      aria-label={`${trocarId ? 'Trocar para' : 'Reservar'} ${formatarHora(h.inicio)}${ultimaVaga ? ', última vaga' : ''}`}
                    >
                      <span className="slot-hora">{formatarHora(h.inicio)}</span>
                      {ultimaVaga && <span className="slot-nota">última vaga</span>}
                    </button>
                  )
                })}
              </div>

              <ul className="legenda-horarios">
                <li><span className="amostra amostra-livre" />Disponível</li>
                {minhasReservasEvento.length > 0 && !trocarId && (
                  <li><span className="amostra amostra-minha" />Sua reserva (toque para cancelar)</li>
                )}
                {horariosDoPeriodo.some((h) => h.vagasLivres === 0) && (
                  <li><span className="amostra amostra-esgotado" />Esgotado</li>
                )}
              </ul>
            </>
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

      {cancelando && (
        <div
          className="modal-fundo"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-cancelar"
          onClick={() => !cancelandoEnviando && setCancelando(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="titulo-modal-cancelar">Cancelar sua reserva?</h2>
            <p className="resumo-horario">
              {formatarHora(cancelando.inicio)}, dia {formatarDataCompleta(evento.dataInicio)}
            </p>
            <p className="descricao">O horário volta a ficar disponível para outros colaboradores.</p>
            {erroCancelamento && <p className="mensagem erro">{erroCancelamento}</p>}
            <div className="acoes-modal">
              <button type="button" className="botao-texto" onClick={() => setCancelando(null)} disabled={cancelandoEnviando}>
                Manter reserva
              </button>
              <button type="button" className="botao-texto-perigo" onClick={confirmarCancelamento} disabled={cancelandoEnviando}>
                {cancelandoEnviando ? 'Cancelando…' : 'Cancelar reserva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
