import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAsyncAction } from '@/lib/useAsyncAction'
import type { FiscalSettings } from './useTenantFiscalSettings'

const REGIMEN_FISCAL_OPTIONS = [
  { value: '626', label: '626 — Régimen Simplificado de Confianza (RESICO)' },
  {
    value: '612',
    label: '612 — Personas Físicas con Actividades Empresariales',
  },
  { value: '621', label: '621 — Incorporación Fiscal (RIF)' },
  { value: '601', label: '601 — General de Ley Personas Morales' },
]

export function BusinessNameForm({
  initialName,
  onSave,
}: {
  initialName: string
  onSave: (name: string) => Promise<boolean>
}) {
  const [name, setName] = useState(initialName)
  const action = useAsyncAction(
    'No se pudo guardar el nombre. Tu captura sigue aquí para reintentar.',
  )
  return (
    <form
      className="max-w-lg space-y-3"
      aria-busy={action.pending}
      onSubmit={async (event) => {
        event.preventDefault()
        if (name.trim()) await action.run(() => onSave(name.trim()))
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="business-name">Nombre del negocio</Label>
          <Input
            id="business-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={action.pending}
          />
        </div>
        <Button type="submit" disabled={action.pending || !name.trim()}>
          {action.pending ? 'Guardando…' : 'Guardar nombre'}
        </Button>
      </div>
      {action.error && (
        <p role="alert" className="text-destructive text-sm">
          {action.error}
        </p>
      )}
    </form>
  )
}

export function FiscalSettingsForm({
  initialSettings,
  onSave,
}: {
  initialSettings: FiscalSettings
  onSave: (values: FiscalSettings) => Promise<boolean>
}) {
  const [values, setValues] = useState(initialSettings)
  const action = useAsyncAction(
    'No se pudieron guardar los datos fiscales. Tu captura sigue aquí para reintentar.',
  )
  const change = (field: keyof FiscalSettings, value: string) =>
    setValues((current) => ({ ...current, [field]: value }))
  return (
    <form
      className="max-w-xl space-y-3"
      aria-busy={action.pending}
      onSubmit={async (event) => {
        event.preventDefault()
        await action.run(() => onSave(values))
      }}
    >
      <fieldset disabled={action.pending} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rfc">RFC</Label>
          <Input
            id="rfc"
            value={values.rfc}
            onChange={(e) => change('rfc', e.target.value)}
            placeholder="XAXX010101000"
            className="uppercase"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="postal-code">
            Código postal (lugar de expedición)
          </Label>
          <Input
            id="postal-code"
            value={values.postalCode}
            onChange={(e) => change('postalCode', e.target.value)}
            placeholder="76000"
            inputMode="numeric"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="legal-name">Razón social</Label>
          <Input
            id="legal-name"
            value={values.legalName}
            onChange={(e) => change('legalName', e.target.value)}
            placeholder="Como aparece ante el SAT"
          />
        </div>
        <div className="min-w-0 space-y-1.5 sm:col-span-2">
          <Label htmlFor="regimen-fiscal">Régimen fiscal</Label>
          <Select
            items={REGIMEN_FISCAL_OPTIONS}
            disabled={action.pending}
            value={values.regimenFiscal || null}
            onValueChange={(value) => change('regimenFiscal', value ?? '')}
          >
            <SelectTrigger id="regimen-fiscal" className="w-full">
              <SelectValue placeholder="Selecciona un régimen" />
            </SelectTrigger>
            <SelectContent>
              {REGIMEN_FISCAL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </fieldset>
      {action.error && (
        <p role="alert" className="text-destructive text-sm">
          {action.error}
        </p>
      )}
      <Button type="submit" disabled={action.pending}>
        {action.pending ? 'Guardando…' : 'Guardar datos fiscales'}
      </Button>
    </form>
  )
}
