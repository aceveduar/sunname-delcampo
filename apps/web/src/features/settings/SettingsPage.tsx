import { useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  MODULE_LABELS,
  useTenantModules,
  type ModuleKey,
} from './useTenantModules'
import { useTenantSettings } from './useTenantSettings'

const TOGGLEABLE_MODULES: ModuleKey[] = ['crm', 'purchasing']
// Facturación todavía no tiene ruta ni funcionalidad construida -- un
// interruptor activo ahí no cambia nada visible, lo cual confunde más de
// lo que ayuda. Se muestra en la lista (transparencia de roadmap) pero
// sin interacción, hasta que exista algo real que prender o apagar.
const COMING_SOON_MODULES: ModuleKey[] = ['billing']

export function SettingsPage() {
  const { isEnabled, setModuleEnabled, loading } = useTenantModules()
  const {
    businessName,
    loading: loadingSettings,
    updateBusinessName,
  } = useTenantSettings()
  const [savingName, setSavingName] = useState(false)

  const handleSubmitName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('business_name') ?? '').trim()
    if (!name) return
    setSavingName(true)
    await updateBusinessName(name)
    setSavingName(false)
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
          {COMING_SOON_MODULES.map((key) => (
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
              <Badge variant="outline">Próximamente</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
