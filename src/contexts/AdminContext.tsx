import { createContext, useContext, type ReactNode } from 'react'

const AdminContext = createContext(false)

export function AdminProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

// Conta administrativa é só para monitoramento — nunca agenda. O bloqueio de verdade é no
// banco (trigger `checar_uma_reserva_por_evento`); isto aqui só evita mostrar a ação.
export function useIsAdmin() {
  return useContext(AdminContext)
}
