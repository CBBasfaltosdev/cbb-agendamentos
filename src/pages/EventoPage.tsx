import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  listarEventosAtivos,
  listarSlots,
  emailValido,
  enviarCodigoConfirmacao,
  confirmarCodigo,
  criarAgendamento,
  meusAgendamentos,
  type Evento,
  type SlotDisponivel,
} from '../lib/bookingService'

type Etapa = 'grade' | 'dados' | 'codigo' | 'sucesso'

function formatarHora(hora: string) {
  return hora.slice(0, 5)
}

export default function EventoPage() {
  const { slug } = useParams<{ slug: string }>()
  const [evento, setEvento] = useState<Evento | null>(null)
  const [slots, setSlots] = useState<SlotDisponivel[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null)

  const [slotSelecionado, setSlotSelecionado] = useState<SlotDisponivel | null>(null)
  const [etapa, setEtapa] = useState<Etapa>('grade')
  const [nome, setNome] = useState('')
  const [matricula, setMatricula] = useState('')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function carregar() {
    if (!slug) return
    setCarregando(true)
    setErroCarregamento(null)
    try {
      const [eventos, listaSlots] = await Promise.all([listarEventosAtivos(), listarSlots(slug)])
      const encontrado = eventos.find((e) => e.slug === slug) ?? null
      setEvento(encontrado)
      setSlots(listaSlots)
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

  const recursos = useMemo(() => {
    const nomes = Array.from(new Set(slots.map((s) => s.recursoNome)))
    return nomes.sort()
  }, [slots])

  const horarios = useMemo(() => {
    const inicios = Array.from(new Set(slots.map((s) => s.inicio)))
    return inicios.sort()
  }, [slots])

  function abrirReserva(slot: SlotDisponivel) {
    if (slot.ocupado) return
    setSlotSelecionado(slot)
    setEtapa('dados')
    setErro(null)
  }

  function fecharFluxo() {
    setSlotSelecionado(null)
    setEtapa('grade')
    setNome('')
    setMatricula('')
    setEmail('')
    setCodigo('')
    setErro(null)
  }

  async function enviarDados(ev: React.FormEvent) {
    ev.preventDefault()
    setErro(null)

    if (!nome.trim() || !matricula.trim()) {
      setErro('Preencha nome e matrícula.')
      return
    }
    if (!emailValido(email)) {
      setErro('Use seu e-mail corporativo (@cbbasfaltos.com.br).')
      return
    }

    setEnviando(true)
    try {
      await enviarCodigoConfirmacao(email)
      setEtapa('codigo')
    } catch (e) {
      setErro('Não foi possível enviar o código. Confira o e-mail e tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  async function confirmarReserva(ev: React.FormEvent) {
    ev.preventDefault()
    if (!slotSelecionado) return
    setErro(null)

    if (!codigo.trim()) {
      setErro('Digite o código recebido por e-mail.')
      return
    }

    setEnviando(true)
    try {
      await confirmarCodigo(email, codigo)

      const existentes = await meusAgendamentos()
      if (existentes.length > 0) {
        const continuar = window.confirm(
          'Você já possui um agendamento neste evento. Como ainda há vagas, você pode reservar outro horário. Confirmar mesmo assim?'
        )
        if (!continuar) {
          setEnviando(false)
          return
        }
      }

      const resultado = await criarAgendamento({
        slotId: slotSelecionado.slotId,
        nome,
        matricula,
        email,
      })

      if (!resultado.ok) {
        if (resultado.motivo === 'slot_ocupado') {
          setErro('Esse horário acabou de ser reservado por outra pessoa. Escolha outro horário.')
          await carregar()
          setEtapa('grade')
          setSlotSelecionado(null)
        } else {
          setErro('Não foi possível confirmar o agendamento. Tente novamente.')
        }
        setEnviando(false)
        return
      }

      setEtapa('sucesso')
      await carregar()
    } catch (e) {
      setErro('Código inválido ou expirado. Solicite um novo código.')
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

      <div className="grade-scroll">
        <table className="grade-horarios">
          <thead>
            <tr>
              <th>Horário</th>
              {recursos.map((r) => (
                <th key={r}>{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {horarios.map((hora) => (
              <tr key={hora}>
                <td className="coluna-hora">{formatarHora(hora)}</td>
                {recursos.map((r) => {
                  const slot = slots.find((s) => s.inicio === hora && s.recursoNome === r)
                  if (!slot) return <td key={r}>—</td>
                  return (
                    <td key={r}>
                      <button
                        type="button"
                        className={slot.ocupado ? 'vaga ocupada' : 'vaga livre'}
                        disabled={slot.ocupado}
                        onClick={() => abrirReserva(slot)}
                      >
                        {slot.ocupado ? 'Ocupado' : 'Reservar'}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {slotSelecionado && etapa !== 'grade' && (
        <div className="modal-fundo" role="dialog" aria-modal="true">
          <div className="modal">
            {etapa === 'dados' && (
              <form onSubmit={enviarDados}>
                <h2>Confirmar horário</h2>
                <p>
                  {slotSelecionado.recursoNome} às {formatarHora(slotSelecionado.inicio)}
                </p>
                <label>
                  Nome completo
                  <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
                </label>
                <label>
                  Matrícula
                  <input value={matricula} onChange={(e) => setMatricula(e.target.value)} />
                </label>
                <label>
                  E-mail corporativo
                  <input
                    type="email"
                    placeholder="nome.sobrenome@cbbasfaltos.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                {erro && <p className="mensagem erro">{erro}</p>}
                <div className="acoes-modal">
                  <button type="button" onClick={fecharFluxo} disabled={enviando}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={enviando}>
                    {enviando ? 'Enviando…' : 'Enviar código de confirmação'}
                  </button>
                </div>
              </form>
            )}

            {etapa === 'codigo' && (
              <form onSubmit={confirmarReserva}>
                <h2>Digite o código</h2>
                <p>Enviamos um código de confirmação para {email}.</p>
                <label>
                  Código
                  <input value={codigo} onChange={(e) => setCodigo(e.target.value)} autoFocus />
                </label>
                {erro && <p className="mensagem erro">{erro}</p>}
                <div className="acoes-modal">
                  <button type="button" onClick={fecharFluxo} disabled={enviando}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={enviando}>
                    {enviando ? 'Confirmando…' : 'Confirmar agendamento'}
                  </button>
                </div>
              </form>
            )}

            {etapa === 'sucesso' && (
              <div>
                <h2>Agendamento confirmado ✅</h2>
                <p>
                  {slotSelecionado.recursoNome} às {formatarHora(slotSelecionado.inicio)}, dia{' '}
                  {new Date(evento.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')}.
                </p>
                <div className="acoes-modal">
                  <button type="button" onClick={fecharFluxo}>
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
