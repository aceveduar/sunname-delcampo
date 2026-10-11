import { useMemo, useState } from 'react'
import { Search, UsersRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TableSkeletonRows } from '@/components/TableSkeletonRows'
import { EmptyState } from '@/components/EmptyState'
import { PaginationControls } from '@/components/PaginationControls'
import { usePagination } from '@/lib/usePagination'
import { normalizeSearch } from '@/lib/text'
import { ROLE_LABELS, isAdminRole } from '@/lib/roles'
import type { Profile } from './useProfiles'

type Role = Profile['role']
const ROLE_ITEMS = (Object.keys(ROLE_LABELS) as Role[]).map((value) => ({
  value,
  label: ROLE_LABELS[value],
}))
const FILTER_ROLES = [{ value: 'all', label: 'Todos los roles' }, ...ROLE_ITEMS]

export function UserDirectory({
  profiles,
  loading,
  error,
  currentUserId,
  currentUserRole,
  onEdit,
  onRoleChange,
  onToggle,
}: {
  profiles: Profile[]
  loading: boolean
  error: string | null
  currentUserId: string
  currentUserRole: Role | null
  onEdit: (profile: Profile) => void
  onRoleChange: (profile: Profile, role: Role) => void
  onToggle: (profile: Profile) => void
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [role, setRole] = useState('all')
  const filtered = useMemo(() => {
    const tokens = normalizeSearch(search).trim().split(/\s+/).filter(Boolean)
    return profiles.filter(
      (profile) =>
        (status === 'all' || profile.active === (status === 'active')) &&
        (role === 'all' || profile.role === role) &&
        tokens.every((token) =>
          normalizeSearch(profile.full_name).includes(token),
        ),
    )
  }, [profiles, search, status, role])
  const pagination = usePagination(filtered)
  const busy = loading || !!error
  const hasFilters = !!search || status !== 'all' || role !== 'all'
  const active = profiles.filter((p) => p.active).length
  const clear = () => {
    setSearch('')
    setStatus('all')
    setRole('all')
    pagination.setPage(1)
  }
  const state = (profile: Profile) => (
    <Badge
      variant="outline"
      className={
        profile.active
          ? 'bg-success/10 text-success border-success/20'
          : 'text-muted-foreground'
      }
    >
      {profile.active ? 'Activo' : 'Inactivo'}
    </Badge>
  )
  const roleControl = (profile: Profile) =>
    currentUserRole === 'owner' && profile.id !== currentUserId ? (
      <Select
        items={ROLE_ITEMS}
        value={profile.role}
        disabled={busy}
        onValueChange={(value) => {
          if (value && value !== profile.role)
            onRoleChange(profile, value as Role)
        }}
      >
        <SelectTrigger
          aria-label={`Rol de ${profile.full_name}`}
          className="w-full min-w-0 md:w-48"
          size="sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLE_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : (
      <span className="text-muted-foreground text-sm">
        {ROLE_LABELS[profile.role]}
      </span>
    )
  const actions = (profile: Profile) => (
    <>
      {isAdminRole(currentUserRole) && (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => onEdit(profile)}
        >
          Editar nombre
        </Button>
      )}
      {profile.id !== currentUserId &&
        (currentUserRole === 'owner' ||
          (currentUserRole === 'local_admin' &&
            profile.role === 'cashier')) && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onToggle(profile)}
          >
            {profile.active ? 'Desactivar' : 'Activar'}
          </Button>
        )}
    </>
  )
  return (
    <section className="space-y-4" aria-label="Directorio del equipo">
      <div className="bg-card space-y-3 rounded-xl border p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value)
              pagination.setPage(1)
            }}
            placeholder="Buscar por nombre"
            aria-label="Buscar usuarios"
            containerClassName="min-w-0 flex-1"
          />
          <Select
            items={FILTER_ROLES}
            value={role}
            onValueChange={(value) => {
              setRole(value ?? 'all')
              pagination.setPage(1)
            }}
          >
            <SelectTrigger
              aria-label="Filtrar por rol"
              className="w-full sm:w-56"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTER_ROLES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Estado del usuario"
        >
          {[
            { id: 'all', label: 'Todos', count: profiles.length },
            { id: 'active', label: 'Activos', count: active },
            {
              id: 'inactive',
              label: 'Inactivos',
              count: profiles.length - active,
            },
          ].map((filter) => (
            <Button
              key={filter.id}
              variant={status === filter.id ? 'default' : 'ghost'}
              size="sm"
              aria-pressed={status === filter.id}
              onClick={() => {
                setStatus(filter.id)
                pagination.setPage(1)
              }}
            >
              {filter.label}{' '}
              <span className="ml-1 text-xs opacity-75">
                {busy ? '—' : filter.count}
              </span>
            </Button>
          ))}
        </div>
      </div>
      {!busy && (
        <p role="status" className="text-muted-foreground text-sm">
          {filtered.length} {filtered.length === 1 ? 'usuario' : 'usuarios'}
          {hasFilters ? ' con estos filtros' : ' en tu equipo'}
        </p>
      )}
      {!busy && !filtered.length ? (
        <div className="bg-card rounded-xl border">
          <EmptyState
            icon={hasFilters ? Search : UsersRound}
            title={
              hasFilters
                ? 'No encontramos coincidencias'
                : 'Tu equipo empieza aquí'
            }
            description={
              hasFilters
                ? 'Prueba con otro nombre, rol o estado.'
                : 'Invita a una persona para darle acceso al negocio.'
            }
          />
          {hasFilters && (
            <div className="pb-6 text-center">
              <Button variant="outline" onClick={clear}>
                Limpiar filtros
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="hidden md:block" aria-label="Tabla del equipo">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !profiles.length && (
                  <TableSkeletonRows rows={5} columns={4} />
                )}
                {pagination.pageItems.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="max-w-xs font-medium wrap-anywhere whitespace-normal">
                      {profile.full_name}
                      {profile.id === currentUserId && (
                        <span className="text-muted-foreground"> (tú)</span>
                      )}
                    </TableCell>
                    <TableCell>{roleControl(profile)}</TableCell>
                    <TableCell>{state(profile)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {actions(profile)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div
            className="grid gap-3 md:hidden"
            aria-label="Tarjetas del equipo"
          >
            {loading && !profiles.length && (
              <p role="status" className="text-muted-foreground">
                Cargando equipo…
              </p>
            )}
            {pagination.pageItems.map((profile) => (
              <article
                key={profile.id}
                className="bg-card min-w-0 space-y-4 rounded-xl border p-4 shadow-sm"
                aria-label={profile.full_name}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 font-semibold wrap-anywhere">
                    {profile.full_name}
                    {profile.id === currentUserId && (
                      <span className="text-muted-foreground text-sm font-normal">
                        {' '}
                        (tú)
                      </span>
                    )}
                  </h2>
                  {state(profile)}
                </div>
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs">Rol de acceso</p>
                  {roleControl(profile)}
                </div>
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  {actions(profile)}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {!busy && (
        <PaginationControls {...pagination} onPageChange={pagination.setPage} />
      )}
    </section>
  )
}
