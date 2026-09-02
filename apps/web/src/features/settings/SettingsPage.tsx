import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MODULE_LABELS,
  useTenantModules,
  type ModuleKey,
} from './useTenantModules'
import { useTenantSettings } from './useTenantSettings'
import { useTenantFiscalSettings } from './useTenantFiscalSettings'

// Ya no hay módulos "próximamente": Facturación tiene una pantalla real
// detrás (aunque el timbrado con un PAC todavía no está conectado) --
// prenderla sí cambia algo visible, que es justo lo que le faltaba para
// dejar de ser un interruptor sin efecto (CLAUDE.md, decisión 2026-08-31).
const TOGGLEABLE_MODULES: ModuleKey[] = ['crm', 'purchasing', 'billing']

const REGIMEN_FISCAL_OPTIONS = [
  { value: '626', label: '626 — Régimen Simplificado de Confianza (RESICO)' },
  { value: '612', label: '612 — Personas Físicas con Actividades Empresariales' },
  { value: '621', label: '621 — Incorporación Fiscal (RIF)' },
  { value: '601', label: '601 — General de Ley Personas Morales' },
]

export function SettingsPage() {
  const { isEnabled, setModuleEnabled, loading } = useTenantModules()
  const {
    businessName,
    loading: loadingSettings,
    updateBusinessName,
  } = useTenantSettings()
  const {
    settings: fiscal,
    loading: loadingFiscal,
    updateSettings: updateFiscalSettings,
  } = useTenantFiscalSettings()
  const [savingName, setSavingName] = useState(false)
  const [savingFiscal, setSavingFiscal] = useState(false)
  const [regimenFiscal, setRegimenFiscal] = useState('')

  const handleSubmitName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('business_name') ?? '').trim()
    if (!name) return
    setSavingName(true)
    await updateBusinessName(name)
    setSavingName(false)
  }

  // El Select de régimen fiscal es controlado (mismo patrón que el resto
  // del sistema) -- se sincroniza una vez que cargan los datos guardados,
  // no se puede leer de FormData porque no es un <select> nativo.
  useEffect(() => {
    if (!loadingFiscal) setRegimenFiscal(fiscal.regimenFiscal)
  }, [loadingFiscal, fiscal.regimenFiscal])

  const handleSubmitFiscal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSavingFiscal(true)
    await updateFiscalSettings({
      rfc: String(form.get('rfc') ?? ''),
      legalName: String(form.get('legal_name') ?? ''),
      regimenFiscal,
      postalCode: String(form.get('postal_code') ?? ''),
    })
    setSavingFiscal(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold">
          Configuración
        </h1>
        <p className="text-muted-foreground text-sm">
          Identidad y módulos activos de tu negocio. Caja, Catálogo e Inventario
          son el núcleo del sistema y siempre están disponibles.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nombre del negocio</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-3 text-sm">
            Aparece en el ticket que se le da al cliente al cerrar una venta. El
            resto del sistema (menús, pantallas internas) siempre muestra la
            identidad de Sunname ERP.
          </p>
          {!loadingSettings && (
            <form onSubmit={handleSubmitName} className="flex max-w-sm gap-2">
              <div className="flex-1">
                <Label htmlFor="business_name" className="sr-only">
                  Nombre del negocio
                </Label>
                <Input
                  id="business_name"
                  name="business_name"
                  defaultValue={businessName}
                  required
                />
              </div>
              <Button type="submit" disabled={savingName}>
                {savingName ? 'Guardando…' : 'Guardar'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Módulos</CardTitle>
        </CardHeader>
        <CardContent className="divide-border flex flex-col divide-y">
          {TOGGLEABLE_MODULES.map((key) => (
            <div
              key={key}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div>
                <p className="text-sm font-medium">{MODULE_LABELS[key].name}</p>
                <p className="text-muted-foreground text-xs">
                  {MODULE_LABELS[key].description}
                </p>
              </div>
              <Switch
                checked={isEnabled(key)}
                disabled={loading}
                onCheckedChange={(checked) => setModuleEnabled(key, checked)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos fiscales</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-3 text-sm">
            Necesarios para timbrar la factura global de cada corte de caja
            (CFDI 4.0). El timbrado con un PAC todavía no está conectado --
            esto solo guarda los datos para cuando lo esté.
          </p>
          {!loadingFiscal && (
            <form
              onSubmit={handleSubmitFiscal}
              className="grid max-w-lg gap-3 sm:grid-cols-2"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rfc">RFC</Label>
                <Input
                  id="rfc"
                  name="rfc"
                  defaultValue={fiscal.rfc}
                  placeholder="XAXX010101000"
                  className="uppercase"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="postal_code">
                  Código postal (lugar de expedición)
                </Label>
                <Input
                  id="postal_code"
                  name="postal_code"
                  defaultValue={fiscal.postalCode}
                  placeholder="76000"
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="legal_name">Razón social</Label>
                <Input
                  id="legal_name"
                  name="legal_name"
                  defaultValue={fiscal.legalName}
                  placeholder="Como aparece ante el SAT"
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="regimen_fiscal">Régimen fiscal</Label>
                <Select
                  items={REGIMEN_FISCAL_OPTIONS}
                  value={regimenFiscal || undefined}
                  onValueChange={(value) => setRegimenFiscal(value ?? '')}
                >
                  <SelectTrigger className="w-full">
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
              <Button type="submit" disabled={savingFiscal} className="w-fit">
                {savingFiscal ? 'Guardando…' : 'Guardar datos fiscales'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
